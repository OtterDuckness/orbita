import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import {
  borrarObjeto,
  GCS_MAX_BYTES,
  mimePermitido,
  objectPathChat,
  subirObjeto,
} from "@/lib/gcs";
import { urlAvatarDe } from "@/lib/usuarios";

/** Tipos del módulo Comunicaciones (schema 009). */

export type TipoConversacion = "dm" | "grupo" | "cliente";

export type RolMiembroConversacion = "miembro" | "admin";

export type TipoReferenciaMensaje = "cliente" | "proyecto";

export type Conversacion = {
  id: string;
  tipo: TipoConversacion;
  nombre: string | null;
  clienteId: string | null;
  dmClave: string | null;
  creadoPorId: string | null;
  creadoEn: string;
};

export type ConversacionMiembro = {
  conversacionId: string;
  usuarioId: string;
  rol: RolMiembroConversacion;
  ultimaLecturaEn: string | null;
};

export type Mensaje = {
  id: string;
  conversacionId: string;
  autorId: string;
  cuerpo: string;
  entregarEn: string | null;
  creadoEn: string;
};

export type MensajeReferencia = {
  id: string;
  mensajeId: string;
  tipo: TipoReferenciaMensaje;
  entidadId: string;
};

export type ReferenciaVista = {
  tipo: TipoReferenciaMensaje;
  entidadId: string;
  etiqueta: string;
  href: string;
};

export type MensajeVista = Mensaje & {
  autorNombre: string;
  autorAvatarUrl: string | null;
  referencias: ReferenciaVista[];
  adjuntos: AdjuntoVista[];
};

export type Adjunto = {
  id: string;
  mensajeId: string | null;
  gcsObject: string;
  nombre: string;
  mime: string | null;
  tamanoBytes: number | null;
  creadoEn: string;
};

export type AdjuntoVista = Adjunto & {
  href: string;
};

export type ConversacionLista = Conversacion & {
  titulo: string;
  ultimoCuerpo: string | null;
  ultimoEn: string | null;
  noLeidos: number;
  miembroIds: string[];
};

type ConvRow = RowDataPacket & {
  id: string;
  tipo: TipoConversacion;
  nombre: string | null;
  cliente_id: string | null;
  dm_clave: string | null;
  creado_por_id: string | null;
  creado_en: Date | string;
  ultimo_cuerpo: string | null;
  ultimo_en: Date | string | null;
  no_leidos: number;
};

type MiembroRow = RowDataPacket & {
  conversacion_id: string;
  usuario_id: string;
  nombre: string;
};

type MensajeRow = RowDataPacket & {
  id: string;
  conversacion_id: string;
  autor_id: string;
  cuerpo: string;
  entregar_en: Date | string | null;
  creado_en: Date | string;
  autor_nombre: string;
  autor_avatar_gcs?: string | null;
};

type RefRow = RowDataPacket & {
  mensaje_id: string;
  tipo: TipoReferenciaMensaje;
  entidad_id: string;
};

type AdjuntoRow = RowDataPacket & {
  id: string;
  mensaje_id: string | null;
  gcs_object: string;
  nombre: string;
  mime: string | null;
  tamano_bytes: number | string | null;
  creado_en: Date | string;
};

type IdRow = RowDataPacket & { id: string };

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function mapConv(r: ConvRow): Conversacion {
  return {
    id: r.id,
    tipo: r.tipo,
    nombre: r.nombre,
    clienteId: r.cliente_id,
    dmClave: r.dm_clave,
    creadoPorId: r.creado_por_id,
    creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
  };
}

/** Clave estable para DM 1:1 (ids ordenados). */
export function dmClaveDe(usuarioA: string, usuarioB: string): string {
  const [a, b] = [usuarioA.trim(), usuarioB.trim()].sort();
  return `${a}:${b}`;
}

export async function esMiembro(conversacionId: string, usuarioId: string): Promise<boolean> {
  const pool = await getPool();
  const [rows] = await pool.execute<IdRow[]>(
    `SELECT conversacion_id AS id FROM conversacion_miembros
     WHERE conversacion_id = ? AND usuario_id = ? LIMIT 1`,
    [conversacionId, usuarioId],
  );
  return Boolean(rows[0]);
}

async function miembrosDe(conversacionIds: string[]): Promise<Map<string, { id: string; nombre: string }[]>> {
  const mapa = new Map<string, { id: string; nombre: string }[]>();
  if (conversacionIds.length === 0) return mapa;
  const pool = await getPool();
  const placeholders = conversacionIds.map(() => "?").join(",");
  const [rows] = await pool.execute<MiembroRow[]>(
    `SELECT cm.conversacion_id, cm.usuario_id, u.nombre
     FROM conversacion_miembros cm
     INNER JOIN usuarios u ON u.id = cm.usuario_id
     WHERE cm.conversacion_id IN (${placeholders})
     ORDER BY u.nombre ASC`,
    conversacionIds,
  );
  for (const r of rows) {
    const list = mapa.get(r.conversacion_id) ?? [];
    list.push({ id: r.usuario_id, nombre: r.nombre });
    mapa.set(r.conversacion_id, list);
  }
  return mapa;
}

function tituloDe(
  c: Conversacion,
  miembros: { id: string; nombre: string }[],
  yoId: string,
): string {
  if (c.tipo === "grupo") return c.nombre?.trim() || "Grupo";
  if (c.tipo === "cliente") return c.nombre?.trim() || "Cliente";
  const otro = miembros.find((m) => m.id !== yoId);
  return otro?.nombre ?? "Mensaje directo";
}

/** Conversaciones internas (dm/grupo) del usuario, con preview y no leídos. */
export async function listarConversacionesDe(usuarioId: string): Promise<ConversacionLista[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<ConvRow[]>(
    `SELECT c.id, c.tipo, c.nombre, c.cliente_id, c.dm_clave, c.creado_por_id, c.creado_en,
            (
              SELECT m.cuerpo FROM mensajes m
              WHERE m.conversacion_id = c.id
              ORDER BY m.creado_en DESC LIMIT 1
            ) AS ultimo_cuerpo,
            (
              SELECT m.creado_en FROM mensajes m
              WHERE m.conversacion_id = c.id
              ORDER BY m.creado_en DESC LIMIT 1
            ) AS ultimo_en,
            (
              SELECT COUNT(*) FROM mensajes m
              WHERE m.conversacion_id = c.id
                AND m.autor_id <> ?
                AND m.creado_en > COALESCE(cm.ultima_lectura_en, '1970-01-01 00:00:00.000')
            ) AS no_leidos
     FROM conversaciones c
     INNER JOIN conversacion_miembros cm
       ON cm.conversacion_id = c.id AND cm.usuario_id = ?
     WHERE c.tipo IN ('dm', 'grupo')
     ORDER BY COALESCE(
       (SELECT m.creado_en FROM mensajes m WHERE m.conversacion_id = c.id ORDER BY m.creado_en DESC LIMIT 1),
       c.creado_en
     ) DESC`,
    [usuarioId, usuarioId],
  );

  const ids = rows.map((r) => r.id);
  const porConv = await miembrosDe(ids);

  return rows.map((r) => {
    const base = mapConv(r);
    const miembros = porConv.get(r.id) ?? [];
    return {
      ...base,
      titulo: tituloDe(base, miembros, usuarioId),
      ultimoCuerpo: r.ultimo_cuerpo,
      ultimoEn: iso(r.ultimo_en),
      noLeidos: Number(r.no_leidos) || 0,
      miembroIds: miembros.map((m) => m.id),
    };
  });
}

/** Total de mensajes no leídos en DMs/grupos del usuario. */
export async function contarNoLeidosDe(
  usuarioId: string,
  excluirConversacionId?: string | null,
): Promise<number> {
  const pool = await getPool();
  const excluir = excluirConversacionId?.trim() || null;
  const [rows] = await pool.execute<RowDataPacket[]>(
    excluir
      ? `SELECT COUNT(*) AS n
         FROM mensajes m
         INNER JOIN conversaciones c ON c.id = m.conversacion_id AND c.tipo IN ('dm', 'grupo')
         INNER JOIN conversacion_miembros cm
           ON cm.conversacion_id = c.id AND cm.usuario_id = ?
         WHERE m.autor_id <> ?
           AND c.id <> ?
           AND m.creado_en > COALESCE(cm.ultima_lectura_en, '1970-01-01 00:00:00.000')`
      : `SELECT COUNT(*) AS n
         FROM mensajes m
         INNER JOIN conversaciones c ON c.id = m.conversacion_id AND c.tipo IN ('dm', 'grupo')
         INNER JOIN conversacion_miembros cm
           ON cm.conversacion_id = c.id AND cm.usuario_id = ?
         WHERE m.autor_id <> ?
           AND m.creado_en > COALESCE(cm.ultima_lectura_en, '1970-01-01 00:00:00.000')`,
    excluir ? [usuarioId, usuarioId, excluir] : [usuarioId, usuarioId],
  );
  return Number(rows[0]?.n) || 0;
}

export async function conversacionPorIdPara(
  conversacionId: string,
  usuarioId: string,
): Promise<ConversacionLista | null> {
  if (!(await esMiembro(conversacionId, usuarioId))) return null;
  const todas = await listarConversacionesDe(usuarioId);
  return todas.find((c) => c.id === conversacionId) ?? null;
}

export async function listarMensajes(
  conversacionId: string,
  usuarioId: string,
  limite = 100,
): Promise<MensajeVista[] | null> {
  if (!(await esMiembro(conversacionId, usuarioId))) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<MensajeRow[]>(
    `SELECT m.id, m.conversacion_id, m.autor_id, m.cuerpo, m.entregar_en, m.creado_en,
            u.nombre AS autor_nombre, u.avatar_gcs AS autor_avatar_gcs
     FROM mensajes m
     INNER JOIN usuarios u ON u.id = m.autor_id
     WHERE m.conversacion_id = ?
     ORDER BY m.creado_en ASC
     LIMIT ${Math.min(Math.max(limite, 1), 500)}`,
    [conversacionId],
  );

  const mensajeIds = rows.map((r) => r.id);
  const refsPorMensaje = await cargarReferenciasDeMensajes(mensajeIds);
  const adjPorMensaje = await cargarAdjuntosDeMensajes(mensajeIds);

  return rows.map((r) => ({
    id: r.id,
    conversacionId: r.conversacion_id,
    autorId: r.autor_id,
    cuerpo: r.cuerpo,
    entregarEn: iso(r.entregar_en),
    creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
    autorNombre: r.autor_nombre,
    autorAvatarUrl: urlAvatarDe(r.autor_id, r.autor_avatar_gcs),
    referencias: refsPorMensaje.get(r.id) ?? [],
    adjuntos: adjPorMensaje.get(r.id) ?? [],
  }));
}

/** Últimos N mensajes (cronológico: más antiguo → más reciente). Sin refs/adjuntos. */
export type MensajeResumen = {
  id: string;
  cuerpo: string;
  autorNombre: string;
  creadoEn: string;
};

export async function listarUltimosMensajes(
  conversacionId: string,
  usuarioId: string,
  limite = 5,
): Promise<MensajeResumen[] | null> {
  if (!(await esMiembro(conversacionId, usuarioId))) return null;
  const n = Math.min(Math.max(limite, 1), 50);
  const pool = await getPool();
  const [rows] = await pool.execute<MensajeRow[]>(
    `SELECT m.id, m.conversacion_id, m.autor_id, m.cuerpo, m.entregar_en, m.creado_en,
            u.nombre AS autor_nombre
     FROM mensajes m
     INNER JOIN usuarios u ON u.id = m.autor_id
     WHERE m.conversacion_id = ?
     ORDER BY m.creado_en DESC
     LIMIT ${n}`,
    [conversacionId],
  );

  return [...rows].reverse().map((r) => ({
    id: r.id,
    cuerpo: r.cuerpo,
    autorNombre: r.autor_nombre,
    creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
  }));
}

/** Un mensaje concreto con refs/adjuntos (p. ej. tras enviar). */
export async function obtenerMensajeVista(
  mensajeId: string,
  usuarioId: string,
): Promise<MensajeVista | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<MensajeRow[]>(
    `SELECT m.id, m.conversacion_id, m.autor_id, m.cuerpo, m.entregar_en, m.creado_en,
            u.nombre AS autor_nombre, u.avatar_gcs AS autor_avatar_gcs
     FROM mensajes m
     INNER JOIN usuarios u ON u.id = m.autor_id
     WHERE m.id = ?
     LIMIT 1`,
    [mensajeId],
  );
  const r = rows[0];
  if (!r) return null;
  if (!(await esMiembro(r.conversacion_id, usuarioId))) return null;

  const refsPorMensaje = await cargarReferenciasDeMensajes([r.id]);
  const adjPorMensaje = await cargarAdjuntosDeMensajes([r.id]);
  return {
    id: r.id,
    conversacionId: r.conversacion_id,
    autorId: r.autor_id,
    cuerpo: r.cuerpo,
    entregarEn: iso(r.entregar_en),
    creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
    autorNombre: r.autor_nombre,
    autorAvatarUrl: urlAvatarDe(r.autor_id, r.autor_avatar_gcs),
    referencias: refsPorMensaje.get(r.id) ?? [],
    adjuntos: adjPorMensaje.get(r.id) ?? [],
  };
}

async function cargarAdjuntosDeMensajes(
  mensajeIds: string[],
): Promise<Map<string, AdjuntoVista[]>> {
  const mapa = new Map<string, AdjuntoVista[]>();
  if (mensajeIds.length === 0) return mapa;
  const pool = await getPool();
  const ph = mensajeIds.map(() => "?").join(",");
  const [rows] = await pool.execute<AdjuntoRow[]>(
    `SELECT id, mensaje_id, gcs_object, nombre, mime, tamano_bytes, creado_en
     FROM adjuntos WHERE mensaje_id IN (${ph})
     ORDER BY creado_en ASC`,
    mensajeIds,
  );
  for (const r of rows) {
    if (!r.mensaje_id) continue;
    const list = mapa.get(r.mensaje_id) ?? [];
    list.push({
      id: r.id,
      mensajeId: r.mensaje_id,
      gcsObject: r.gcs_object,
      nombre: r.nombre,
      mime: r.mime,
      tamanoBytes: r.tamano_bytes == null ? null : Number(r.tamano_bytes),
      creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
      href: `/api/adjuntos/${r.id}`,
    });
    mapa.set(r.mensaje_id, list);
  }
  return mapa;
}

async function cargarReferenciasDeMensajes(
  mensajeIds: string[],
): Promise<Map<string, ReferenciaVista[]>> {
  const mapa = new Map<string, ReferenciaVista[]>();
  if (mensajeIds.length === 0) return mapa;

  const pool = await getPool();
  const ph = mensajeIds.map(() => "?").join(",");
  const [rows] = await pool.execute<RefRow[]>(
    `SELECT mensaje_id, tipo, entidad_id FROM mensaje_referencias
     WHERE mensaje_id IN (${ph})`,
    mensajeIds,
  );

  const clienteIds = [...new Set(rows.filter((r) => r.tipo === "cliente").map((r) => r.entidad_id))];
  const proyectoIds = [...new Set(rows.filter((r) => r.tipo === "proyecto").map((r) => r.entidad_id))];

  const nombresCliente = new Map<string, string>();
  if (clienteIds.length > 0) {
    const cph = clienteIds.map(() => "?").join(",");
    const [cRows] = await pool.execute<(RowDataPacket & { id: string; nombre: string })[]>(
      `SELECT id, nombre FROM clientes WHERE id IN (${cph})`,
      clienteIds,
    );
    for (const c of cRows) nombresCliente.set(c.id, c.nombre);
  }

  const etiquetasProyecto = new Map<string, string>();
  if (proyectoIds.length > 0) {
    const pph = proyectoIds.map(() => "?").join(",");
    const [pRows] = await pool.execute<
      (RowDataPacket & { id: string; tipo_nombre: string | null; cliente_nombre: string | null })[]
    >(
      `SELECT p.id, t.nombre AS tipo_nombre, c.nombre AS cliente_nombre
       FROM proyectos p
       LEFT JOIN tipos_proyecto t ON t.id = p.tipo_id
       LEFT JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id IN (${pph})`,
      proyectoIds,
    );
    for (const p of pRows) {
      const tipo = p.tipo_nombre?.trim() || "Proyecto";
      const etiqueta = p.cliente_nombre ? `${p.cliente_nombre} · ${tipo}` : tipo;
      etiquetasProyecto.set(p.id, etiqueta);
    }
  }

  for (const r of rows) {
    const list = mapa.get(r.mensaje_id) ?? [];
    if (r.tipo === "cliente") {
      list.push({
        tipo: "cliente",
        entidadId: r.entidad_id,
        etiqueta: nombresCliente.get(r.entidad_id) ?? "Cliente",
        href: "/clientes",
      });
    } else {
      list.push({
        tipo: "proyecto",
        entidadId: r.entidad_id,
        etiqueta: etiquetasProyecto.get(r.entidad_id) ?? "Proyecto",
        href: `/proyectos/${r.entidad_id}`,
      });
    }
    mapa.set(r.mensaje_id, list);
  }
  return mapa;
}

export async function marcarLeido(
  conversacionId: string,
  usuarioId: string,
): Promise<{ ok: true } | { ok: false; motivo: "sin_acceso" }> {
  if (!(await esMiembro(conversacionId, usuarioId))) {
    return { ok: false, motivo: "sin_acceso" };
  }
  const pool = await getPool();
  await pool.execute(
    `UPDATE conversacion_miembros
     SET ultima_lectura_en = CURRENT_TIMESTAMP(3)
     WHERE conversacion_id = ? AND usuario_id = ?`,
    [conversacionId, usuarioId],
  );
  return { ok: true };
}

export async function abrirOCrearDm(
  yoId: string,
  otroId: string,
): Promise<
  | { ok: true; conversacionId: string; creado: boolean }
  | { ok: false; motivo: "falta_dato" | "mismo_usuario" | "destino_invalido" }
> {
  const a = yoId.trim();
  const b = otroId.trim();
  if (!a || !b) return { ok: false, motivo: "falta_dato" };
  if (a === b) return { ok: false, motivo: "mismo_usuario" };

  const pool = await getPool();
  const [dest] = await pool.execute<IdRow[]>(
    "SELECT id FROM usuarios WHERE id = ? LIMIT 1",
    [b],
  );
  if (!dest[0]) return { ok: false, motivo: "destino_invalido" };

  const clave = dmClaveDe(a, b);
  const [existentes] = await pool.execute<IdRow[]>(
    "SELECT id FROM conversaciones WHERE tipo = 'dm' AND dm_clave = ? LIMIT 1",
    [clave],
  );
  if (existentes[0]) {
    return { ok: true, conversacionId: existentes[0].id, creado: false };
  }

  const id = randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO conversaciones (id, tipo, nombre, cliente_id, dm_clave, creado_por_id)
       VALUES (?, 'dm', NULL, NULL, ?, ?)`,
      [id, clave, a],
    );
    await conn.execute(
      `INSERT INTO conversacion_miembros (conversacion_id, usuario_id, rol)
       VALUES (?, ?, 'miembro'), (?, ?, 'miembro')`,
      [id, a, id, b],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { ok: true, conversacionId: id, creado: true };
}

export async function crearGrupo(
  yoId: string,
  nombreRaw: string,
  miembroIds: string[],
): Promise<
  | { ok: true; conversacionId: string }
  | { ok: false; motivo: "falta_dato" | "sin_miembros" }
> {
  const nombre = nombreRaw.trim();
  if (!nombre) return { ok: false, motivo: "falta_dato" };

  const ids = [...new Set(miembroIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.includes(yoId)) ids.push(yoId);
  if (ids.length < 2) return { ok: false, motivo: "sin_miembros" };

  const pool = await getPool();
  if (ids.length > 0) {
    const ph = ids.map(() => "?").join(",");
    const [validos] = await pool.execute<IdRow[]>(
      `SELECT id FROM usuarios WHERE id IN (${ph})`,
      ids,
    );
    if (validos.length !== ids.length) return { ok: false, motivo: "falta_dato" };
  }

  const id = randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO conversaciones (id, tipo, nombre, cliente_id, dm_clave, creado_por_id)
       VALUES (?, 'grupo', ?, NULL, NULL, ?)`,
      [id, nombre, yoId],
    );
    for (const uid of ids) {
      await conn.execute(
        `INSERT INTO conversacion_miembros (conversacion_id, usuario_id, rol)
         VALUES (?, ?, ?)`,
        [id, uid, uid === yoId ? "admin" : "miembro"],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { ok: true, conversacionId: id };
}

export type RefInput = { tipo: TipoReferenciaMensaje; entidadId: string };

export type ArchivoAdjuntoInput = {
  buffer: Buffer;
  nombre: string;
  mime: string;
  tamanoBytes: number;
};

export async function enviarMensaje(
  conversacionId: string,
  autorId: string,
  cuerpoRaw: string,
  refsRaw: RefInput[] = [],
  archivos: ArchivoAdjuntoInput[] = [],
): Promise<
  | { ok: true; mensaje: Mensaje }
  | {
      ok: false;
      motivo:
        | "falta_dato"
        | "sin_acceso"
        | "vacio"
        | "ref_invalida"
        | "archivo_invalido"
        | "archivo_grande"
        | "gcs_error";
    }
> {
  const cuerpo = cuerpoRaw.trim();
  if (!conversacionId || !autorId) return { ok: false, motivo: "falta_dato" };

  const refsUnicas = dedupeRefs(refsRaw);
  if (!cuerpo && refsUnicas.length === 0 && archivos.length === 0) {
    return { ok: false, motivo: "vacio" };
  }
  if (!(await esMiembro(conversacionId, autorId))) {
    return { ok: false, motivo: "sin_acceso" };
  }

  const refsOk = await validarReferencias(refsUnicas);
  if (!refsOk) return { ok: false, motivo: "ref_invalida" };

  for (const a of archivos) {
    if (a.tamanoBytes <= 0 || a.tamanoBytes > GCS_MAX_BYTES) {
      return { ok: false, motivo: "archivo_grande" };
    }
    if (!mimePermitido(a.mime)) return { ok: false, motivo: "archivo_invalido" };
  }

  const id = randomUUID();
  const subidos: string[] = [];

  try {
    for (const a of archivos) {
      const path = await objectPathChat(conversacionId, id, a.nombre);
      await subirObjeto({ objectPath: path, buffer: a.buffer, mime: a.mime });
      subidos.push(path);
    }
  } catch (err) {
    console.error("[gcs] upload falló", err);
    for (const path of subidos) {
      try {
        await borrarObjeto(path);
      } catch {
        /* ignore */
      }
    }
    return { ok: false, motivo: "gcs_error" };
  }

  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO mensajes (id, conversacion_id, autor_id, cuerpo, entregar_en)
       VALUES (?, ?, ?, ?, NULL)`,
      [id, conversacionId, autorId, cuerpo || " "],
    );
    for (const ref of refsUnicas) {
      await conn.execute(
        `INSERT INTO mensaje_referencias (id, mensaje_id, tipo, entidad_id)
         VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, ref.tipo, ref.entidadId],
      );
    }
    for (let i = 0; i < archivos.length; i++) {
      const a = archivos[i]!;
      const path = subidos[i]!;
      await conn.execute(
        `INSERT INTO adjuntos (id, mensaje_id, gcs_object, nombre, mime, tamano_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), id, path, a.nombre.slice(0, 500), a.mime, a.tamanoBytes],
      );
    }
    await conn.execute(
      `UPDATE conversaciones SET actualizado_en = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [conversacionId],
    );
    await conn.execute(
      `UPDATE conversacion_miembros
       SET ultima_lectura_en = CURRENT_TIMESTAMP(3)
       WHERE conversacion_id = ? AND usuario_id = ?`,
      [conversacionId, autorId],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    for (const path of subidos) {
      try {
        await borrarObjeto(path);
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    conn.release();
  }

  const creadoEn = new Date().toISOString();
  return {
    ok: true,
    mensaje: {
      id,
      conversacionId,
      autorId,
      cuerpo: cuerpo || " ",
      entregarEn: null,
      creadoEn,
    },
  };
}

/** Adjunto + comprueba que el usuario es miembro de la conversación del mensaje. */
export async function adjuntoParaDescarga(
  adjuntoId: string,
  usuarioId: string,
): Promise<
  | { ok: true; adjunto: Adjunto }
  | { ok: false; motivo: "no_encontrado" | "sin_acceso" }
> {
  const pool = await getPool();
  const [rows] = await pool.execute<AdjuntoRow[]>(
    `SELECT a.id, a.mensaje_id, a.gcs_object, a.nombre, a.mime, a.tamano_bytes, a.creado_en,
            m.conversacion_id
     FROM adjuntos a
     INNER JOIN mensajes m ON m.id = a.mensaje_id
     WHERE a.id = ? LIMIT 1`,
    [adjuntoId],
  );
  const r = rows[0] as (AdjuntoRow & { conversacion_id: string }) | undefined;
  if (!r?.mensaje_id) return { ok: false, motivo: "no_encontrado" };
  if (!(await esMiembro(r.conversacion_id, usuarioId))) {
    return { ok: false, motivo: "sin_acceso" };
  }
  return {
    ok: true,
    adjunto: {
      id: r.id,
      mensajeId: r.mensaje_id,
      gcsObject: r.gcs_object,
      nombre: r.nombre,
      mime: r.mime,
      tamanoBytes: r.tamano_bytes == null ? null : Number(r.tamano_bytes),
      creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
    },
  };
}

function dedupeRefs(refs: RefInput[]): RefInput[] {
  const seen = new Set<string>();
  const out: RefInput[] = [];
  for (const r of refs) {
    const tipo = r.tipo === "proyecto" ? "proyecto" : r.tipo === "cliente" ? "cliente" : null;
    const entidadId = r.entidadId.trim();
    if (!tipo || !entidadId) continue;
    const key = `${tipo}:${entidadId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tipo, entidadId });
  }
  return out;
}

async function validarReferencias(refs: RefInput[]): Promise<boolean> {
  if (refs.length === 0) return true;
  const pool = await getPool();
  for (const r of refs) {
    if (r.tipo === "cliente") {
      const [rows] = await pool.execute<IdRow[]>(
        "SELECT id FROM clientes WHERE id = ? LIMIT 1",
        [r.entidadId],
      );
      if (!rows[0]) return false;
    } else {
      const [rows] = await pool.execute<IdRow[]>(
        "SELECT id FROM proyectos WHERE id = ? LIMIT 1",
        [r.entidadId],
      );
      if (!rows[0]) return false;
    }
  }
  return true;
}

/** Parsea `cliente:uuid` / `proyecto:uuid` desde query o form. */
export function parseRefToken(raw: string): RefInput | null {
  const s = raw.trim();
  const i = s.indexOf(":");
  if (i <= 0) return null;
  const tipo = s.slice(0, i);
  const entidadId = s.slice(i + 1).trim();
  if ((tipo !== "cliente" && tipo !== "proyecto") || !entidadId) return null;
  return { tipo, entidadId };
}

