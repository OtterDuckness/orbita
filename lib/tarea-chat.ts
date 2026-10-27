import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import {
  borrarObjeto,
  GCS_MAX_BYTES,
  mimePermitido,
  objectPathTarea,
  subirObjeto,
} from "@/lib/gcs";
import { puedeNotasChatAdjuntos } from "@/lib/permisos-entidad";
import { tareaPorId } from "@/lib/tablero";
import { urlAvatarDe } from "@/lib/usuarios";

export type MensajeTarea = {
  id: string;
  tareaId: string;
  autorId: string;
  autorNombre: string;
  autorAvatarUrl: string | null;
  cuerpo: string;
  creadoEn: string;
};

export type AdjuntoTarea = {
  id: string;
  tareaId: string;
  gcsObject: string;
  nombre: string;
  mime: string | null;
  tamanoBytes: number | null;
  creadoEn: string;
  href: string;
};

export type ArchivoAdjuntoInput = {
  buffer: Buffer;
  nombre: string;
  mime: string;
  tamanoBytes: number;
};

type MensajeRow = RowDataPacket & {
  id: string;
  tarea_id: string;
  autor_id: string;
  autor_nombre: string;
  autor_avatar_gcs: string | null;
  cuerpo: string;
  creado_en: Date | string;
};

type AdjuntoRow = RowDataPacket & {
  id: string;
  tarea_id: string | null;
  mensaje_id: string | null;
  gcs_object: string;
  nombre: string;
  mime: string | null;
  tamano_bytes: number | string | null;
  creado_en: Date | string;
};

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Acceso a la tarea: admin, dueño personal, responsable de cliente/proyecto, colaborador, solicitante o asignado. */
export async function puedeAccederTarea(
  tareaId: string,
  usuarioId: string,
  esAdmin = false,
): Promise<boolean> {
  return puedeNotasChatAdjuntos({ id: usuarioId, esAdmin }, tareaId);
}

export async function mensajesDeTarea(tareaId: string): Promise<MensajeTarea[]> {
  const tid = tareaId.trim();
  if (!tid) return [];
  const pool = await getPool();
  const [rows] = await pool.execute<MensajeRow[]>(
    `SELECT m.id, m.tarea_id, m.autor_id, m.cuerpo, m.creado_en,
            u.nombre AS autor_nombre, u.avatar_gcs AS autor_avatar_gcs
     FROM tarea_mensajes m
     JOIN usuarios u ON u.id = m.autor_id
     WHERE m.tarea_id = ?
     ORDER BY m.creado_en ASC
     LIMIT 300`,
    [tid],
  );
  return rows.map((r) => ({
    id: r.id,
    tareaId: r.tarea_id,
    autorId: r.autor_id,
    autorNombre: r.autor_nombre,
    autorAvatarUrl: urlAvatarDe(r.autor_id, r.autor_avatar_gcs),
    cuerpo: r.cuerpo,
    creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
  }));
}

/** Marca el chat de la tarea como visto hasta ahora (idempotente). */
export async function marcarChatTareaVisto(
  tareaId: string,
  usuarioId: string,
): Promise<void> {
  const tid = tareaId.trim();
  const uid = usuarioId.trim();
  if (!tid || !uid) return;
  try {
    const pool = await getPool();
    await pool.execute(
      `INSERT INTO tarea_chat_vistos (tarea_id, usuario_id, visto_en)
       VALUES (?, ?, CURRENT_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE visto_en = VALUES(visto_en)`,
      [tid, uid],
    );
  } catch (error) {
    console.error("[tarea-chat] marcarChatTareaVisto falló", {
      tareaId: tid,
      usuarioId: uid,
      error,
    });
  }
}

export type ChatTareaSinLeer = {
  tareaId: string;
  proyectoId: string;
  titulo: string;
  noLeidos: number;
  ultimoEn: string | null;
  ultimoCuerpo: string | null;
  /** Si true, abrir en /tareas; si no, en el tablero del proyecto. */
  esPersonal: boolean;
};

/**
 * Chats de tarea con mensajes de otros posteriores al último visto.
 * Solo tareas donde el usuario es responsable, solicitante o miembro del proyecto.
 */
export async function chatsTareaSinLeer(
  usuarioId: string,
  limite = 20,
): Promise<ChatTareaSinLeer[]> {
  const uid = usuarioId.trim();
  if (!uid) return [];
  const lim = Math.max(1, Math.min(50, Math.floor(limite)));
  const pool = await getPool();
  try {
    const [rows] = await pool.execute<
      (RowDataPacket & {
        tarea_id: string;
        proyecto_id: string;
        nombre: string;
        personal_de_id: string | null;
        no_leidos: number;
        ultimo_en: Date | string | null;
        ultimo_cuerpo: string | null;
      })[]
    >(
      `SELECT t.id AS tarea_id, t.proyecto_id, t.nombre, p.personal_de_id,
              COUNT(*) AS no_leidos,
              MAX(m.creado_en) AS ultimo_en,
              (
                SELECT m2.cuerpo
                FROM tarea_mensajes m2
                WHERE m2.tarea_id = t.id
                ORDER BY m2.creado_en DESC
                LIMIT 1
              ) AS ultimo_cuerpo
       FROM tarea_mensajes m
       JOIN tareas t ON t.id = m.tarea_id
       JOIN proyectos p ON p.id = t.proyecto_id
       LEFT JOIN tarea_chat_vistos v
         ON v.tarea_id = m.tarea_id AND v.usuario_id = ?
       WHERE m.autor_id <> ?
         AND (v.visto_en IS NULL OR m.creado_en > v.visto_en)
         AND (t.completada_en IS NULL OR m.creado_en > t.completada_en)
         AND (
           JSON_CONTAINS(t.responsable_ids, JSON_QUOTE(?))
           OR t.mandada_por_id = ?
           OR p.personal_de_id = ?
           OR EXISTS (
             SELECT 1 FROM proyecto_miembros pm
             WHERE pm.proyecto_id = t.proyecto_id AND pm.usuario_id = ?
           )
         )
       GROUP BY t.id, t.proyecto_id, t.nombre, p.personal_de_id
       ORDER BY ultimo_en DESC
       LIMIT ${lim}`,
      [uid, uid, uid, uid, uid, uid],
    );
    return rows.map((r) => ({
      tareaId: r.tarea_id,
      proyectoId: r.proyecto_id,
      titulo: r.nombre,
      noLeidos: Number(r.no_leidos) || 0,
      ultimoEn: iso(r.ultimo_en),
      ultimoCuerpo: r.ultimo_cuerpo?.trim() || null,
      esPersonal: r.personal_de_id === uid,
    }));
  } catch (error) {
    console.error("[tarea-chat] chatsTareaSinLeer falló (¿falta migración 026?)", {
      usuarioId: uid,
      error,
    });
    return [];
  }
}

/** IDs de tarea con chat sin leer (para punto amarillo en listados). */
export async function idsTareasChatSinLeer(usuarioId: string): Promise<string[]> {
  const lista = await chatsTareaSinLeer(usuarioId, 50);
  return lista.map((c) => c.tareaId);
}

export async function enviarMensajeTarea(
  tareaId: string,
  autorId: string,
  cuerpoRaw: string,
): Promise<
  | { ok: true; mensaje: MensajeTarea }
  | { ok: false; motivo: "falta_dato" | "no_encontrado" }
> {
  const tid = tareaId.trim();
  const aid = autorId.trim();
  const cuerpo = cuerpoRaw.trim().slice(0, 4000);
  if (!tid || !aid || !cuerpo) return { ok: false, motivo: "falta_dato" };
  if (!(await tareaPorId(tid))) return { ok: false, motivo: "no_encontrado" };

  const id = randomUUID();
  const creado = new Date();
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO tarea_mensajes (id, tarea_id, autor_id, cuerpo, creado_en) VALUES (?, ?, ?, ?, ?)`,
    [id, tid, aid, cuerpo, creado],
  );

  const [rows] = await pool.execute<(RowDataPacket & { nombre: string; avatar_gcs: string | null })[]>(
    "SELECT nombre, avatar_gcs FROM usuarios WHERE id = ? LIMIT 1",
    [aid],
  );

  return {
    ok: true,
    mensaje: {
      id,
      tareaId: tid,
      autorId: aid,
      autorNombre: rows[0]?.nombre ?? "Usuario",
      autorAvatarUrl: urlAvatarDe(aid, rows[0]?.avatar_gcs),
      cuerpo,
      creadoEn: creado.toISOString(),
    },
  };
}

export async function adjuntosDeTarea(tareaId: string): Promise<AdjuntoTarea[]> {
  const tid = tareaId.trim();
  if (!tid) return [];
  const pool = await getPool();
  const [rows] = await pool.execute<AdjuntoRow[]>(
    `SELECT id, tarea_id, mensaje_id, gcs_object, nombre, mime, tamano_bytes, creado_en
     FROM adjuntos WHERE tarea_id = ?
     ORDER BY creado_en ASC`,
    [tid],
  );
  return rows.map((r) => ({
    id: r.id,
    tareaId: r.tarea_id!,
    gcsObject: r.gcs_object,
    nombre: r.nombre,
    mime: r.mime,
    tamanoBytes: r.tamano_bytes == null ? null : Number(r.tamano_bytes),
    creadoEn: iso(r.creado_en) ?? new Date().toISOString(),
    href: `/api/adjuntos/${r.id}`,
  }));
}

export async function subirAdjuntoTarea(
  tareaId: string,
  archivo: ArchivoAdjuntoInput,
): Promise<
  | { ok: true; adjunto: AdjuntoTarea }
  | {
      ok: false;
      motivo: "falta_dato" | "no_encontrado" | "archivo_invalido" | "archivo_grande" | "gcs_error";
    }
> {
  const tid = tareaId.trim();
  if (!tid) return { ok: false, motivo: "falta_dato" };
  if (!(await tareaPorId(tid))) return { ok: false, motivo: "no_encontrado" };
  if (archivo.tamanoBytes <= 0 || archivo.tamanoBytes > GCS_MAX_BYTES) {
    return { ok: false, motivo: "archivo_grande" };
  }
  if (!mimePermitido(archivo.mime)) return { ok: false, motivo: "archivo_invalido" };

  const path = await objectPathTarea(tid, archivo.nombre);
  try {
    await subirObjeto({ objectPath: path, buffer: archivo.buffer, mime: archivo.mime });
  } catch (err) {
    console.error("[gcs] upload tarea falló", err);
    return { ok: false, motivo: "gcs_error" };
  }

  const id = randomUUID();
  const pool = await getPool();
  try {
    await pool.execute(
      `INSERT INTO adjuntos (id, mensaje_id, tarea_id, gcs_object, nombre, mime, tamano_bytes)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [id, tid, path, archivo.nombre.slice(0, 500), archivo.mime, archivo.tamanoBytes],
    );
  } catch (err) {
    await borrarObjeto(path).catch(() => {});
    console.error("[db] insert adjunto tarea falló", err);
    return { ok: false, motivo: "gcs_error" };
  }

  return {
    ok: true,
    adjunto: {
      id,
      tareaId: tid,
      gcsObject: path,
      nombre: archivo.nombre.slice(0, 500),
      mime: archivo.mime,
      tamanoBytes: archivo.tamanoBytes,
      creadoEn: new Date().toISOString(),
      href: `/api/adjuntos/${id}`,
    },
  };
}

export async function borrarAdjuntoTarea(
  adjuntoId: string,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" }> {
  const pool = await getPool();
  const [rows] = await pool.execute<AdjuntoRow[]>(
    `SELECT id, tarea_id, gcs_object FROM adjuntos WHERE id = ? AND tarea_id IS NOT NULL LIMIT 1`,
    [adjuntoId],
  );
  const r = rows[0];
  if (!r) return { ok: false, motivo: "no_encontrado" };
  await pool.execute("DELETE FROM adjuntos WHERE id = ?", [adjuntoId]);
  await borrarObjeto(r.gcs_object).catch(() => {});
  return { ok: true };
}

/** Descarga: adjunto de tarea (sin mensaje). */
export async function adjuntoTareaParaDescarga(
  adjuntoId: string,
  usuarioId: string,
  esAdmin = false,
): Promise<
  | { ok: true; adjunto: { id: string; gcsObject: string; nombre: string; mime: string | null } }
  | { ok: false; motivo: "no_encontrado" | "sin_acceso" }
> {
  const pool = await getPool();
  const [rows] = await pool.execute<AdjuntoRow[]>(
    `SELECT id, tarea_id, gcs_object, nombre, mime
     FROM adjuntos WHERE id = ? AND tarea_id IS NOT NULL LIMIT 1`,
    [adjuntoId],
  );
  const r = rows[0];
  if (!r?.tarea_id) return { ok: false, motivo: "no_encontrado" };
  if (!(await puedeAccederTarea(r.tarea_id, usuarioId, esAdmin))) {
    return { ok: false, motivo: "sin_acceso" };
  }
  return {
    ok: true,
    adjunto: {
      id: r.id,
      gcsObject: r.gcs_object,
      nombre: r.nombre,
      mime: r.mime,
    },
  };
}
