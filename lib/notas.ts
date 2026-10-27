import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { urlAvatarDe } from "@/lib/usuarios";

const TEXTO_MAX = 10_000;

export type Nota = {
  id: string;
  texto: string;
  autorId: string;
  autorNombre: string;
  autorAvatarUrl: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  proyectoId: string | null;
  clienteId: string | null;
};

type NotaRow = RowDataPacket & {
  id: string;
  texto: string;
  autor_id: string;
  autor_nombre: string | null;
  autor_avatar_gcs: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
  proyecto_id: string | null;
  cliente_id: string | null;
};

function aFecha(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function mapear(r: NotaRow): Nota {
  return {
    id: r.id,
    texto: r.texto,
    autorId: r.autor_id,
    autorNombre: r.autor_nombre?.trim() || "—",
    autorAvatarUrl: urlAvatarDe(r.autor_id, r.autor_avatar_gcs),
    creadoEn: aFecha(r.creado_en),
    actualizadoEn: aFecha(r.actualizado_en),
    proyectoId: r.proyecto_id,
    clienteId: r.cliente_id,
  };
}

const SELECT = `
  SELECT n.id, n.texto, n.autor_id, u.nombre AS autor_nombre, u.avatar_gcs AS autor_avatar_gcs,
         n.creado_en, n.actualizado_en, n.proyecto_id, n.cliente_id
  FROM notas n
  LEFT JOIN usuarios u ON u.id = n.autor_id`;

export async function listarNotasProyecto(proyectoId: string): Promise<Nota[]> {
  const id = proyectoId.trim();
  if (!id) return [];
  const pool = await getPool();
  const [rows] = await pool.execute<NotaRow[]>(
    `${SELECT} WHERE n.proyecto_id = ? ORDER BY n.creado_en DESC`,
    [id],
  );
  return rows.map(mapear);
}

/** Notas generales del cliente (sin proyecto). */
export async function listarNotasCliente(clienteId: string): Promise<Nota[]> {
  const id = clienteId.trim();
  if (!id) return [];
  const pool = await getPool();
  const [rows] = await pool.execute<NotaRow[]>(
    `${SELECT} WHERE n.cliente_id = ? AND n.proyecto_id IS NULL ORDER BY n.creado_en DESC`,
    [id],
  );
  return rows.map(mapear);
}

export async function crearNotaCliente(
  clienteId: string,
  texto: string,
  autorId: string,
): Promise<{ ok: true; nota: Nota } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const cid = clienteId.trim();
  const limpio = texto.slice(0, TEXTO_MAX).trim();
  const aid = autorId.trim();
  if (!cid || !limpio || !aid) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [cli] = await pool.execute<(RowDataPacket & { id: string })[]>(
    "SELECT id FROM clientes WHERE id = ? LIMIT 1",
    [cid],
  );
  if (!cli[0]) return { ok: false, motivo: "no_encontrado" };

  const id = randomUUID();
  const ahora = new Date();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO notas (id, texto, autor_id, creado_en, actualizado_en, proyecto_id, cliente_id)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [id, limpio, aid, ahora, ahora, cid],
  );

  const [rows] = await pool.execute<NotaRow[]>(`${SELECT} WHERE n.id = ? LIMIT 1`, [id]);
  const nota = rows[0] ? mapear(rows[0]) : null;
  if (!nota) return { ok: false, motivo: "no_encontrado" };
  return { ok: true, nota };
}

export async function crearNotaProyecto(
  proyectoId: string,
  texto: string,
  autorId: string,
): Promise<{ ok: true; nota: Nota } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const pid = proyectoId.trim();
  const limpio = texto.slice(0, TEXTO_MAX).trim();
  const aid = autorId.trim();
  if (!pid || !limpio || !aid) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [proy] = await pool.execute<(RowDataPacket & { cliente_id: string | null })[]>(
    "SELECT cliente_id FROM proyectos WHERE id = ? LIMIT 1",
    [pid],
  );
  if (!proy[0]) return { ok: false, motivo: "no_encontrado" };

  const id = randomUUID();
  const ahora = new Date();
  await pool.execute<ResultSetHeader>(
    `INSERT INTO notas (id, texto, autor_id, creado_en, actualizado_en, proyecto_id, cliente_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, limpio, aid, ahora, ahora, pid, proy[0].cliente_id],
  );

  const [rows] = await pool.execute<NotaRow[]>(`${SELECT} WHERE n.id = ? LIMIT 1`, [id]);
  const nota = rows[0] ? mapear(rows[0]) : null;
  if (!nota) return { ok: false, motivo: "no_encontrado" };
  return { ok: true, nota };
}

export async function actualizarNota(
  notaId: string,
  texto: string,
  autorId: string,
): Promise<
  | { ok: true; nota: Nota }
  | { ok: false; motivo: "falta_dato" | "no_encontrado" | "no_autor" }
> {
  const id = notaId.trim();
  const limpio = texto.slice(0, TEXTO_MAX).trim();
  const aid = autorId.trim();
  if (!id || !limpio || !aid) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [exist] = await pool.execute<(RowDataPacket & { autor_id: string })[]>(
    "SELECT autor_id FROM notas WHERE id = ? LIMIT 1",
    [id],
  );
  if (!exist[0]) return { ok: false, motivo: "no_encontrado" };
  if (exist[0].autor_id !== aid) return { ok: false, motivo: "no_autor" };

  const ahora = new Date();
  await pool.execute(`UPDATE notas SET texto = ?, actualizado_en = ? WHERE id = ?`, [
    limpio,
    ahora,
    id,
  ]);

  const [rows] = await pool.execute<NotaRow[]>(`${SELECT} WHERE n.id = ? LIMIT 1`, [id]);
  const nota = rows[0] ? mapear(rows[0]) : null;
  if (!nota) return { ok: false, motivo: "no_encontrado" };
  return { ok: true, nota };
}

export async function borrarNota(
  notaId: string,
  autorId: string,
): Promise<{ ok: true } | { ok: false; motivo: "falta_dato" | "no_encontrado" | "no_autor" }> {
  const id = notaId.trim();
  const aid = autorId.trim();
  if (!id || !aid) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [exist] = await pool.execute<(RowDataPacket & { autor_id: string })[]>(
    "SELECT autor_id FROM notas WHERE id = ? LIMIT 1",
    [id],
  );
  if (!exist[0]) return { ok: false, motivo: "no_encontrado" };
  if (exist[0].autor_id !== aid) return { ok: false, motivo: "no_autor" };

  await pool.execute("DELETE FROM notas WHERE id = ?", [id]);
  return { ok: true };
}
