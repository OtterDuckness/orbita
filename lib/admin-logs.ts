import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type LogArea = "admin" | "clientes" | "proyectos" | "tareas";

export type AdminLogEntry = {
  id: string;
  actorId: string | null;
  actorCorreo: string;
  accion: string;
  detalle: string | null;
  metaJson: unknown;
  creadoEn: Date;
  nota: string | null;
  notaAutorId: string | null;
  notaAutorNombre: string | null;
  notaCreadoEn: Date | null;
};

const NOTA_MAX = 10_000;

const ETIQUETAS: Record<string, string> = {
  usuario_creado: "Usuario creado",
  usuario_eliminado: "Usuario eliminado",
  admin_concedido: "Admin concedido",
  admin_revocado: "Admin revocado",
  perfil_creado: "Perfil creado",
  perfil_guardado: "Perfil guardado",
  perfil_eliminado: "Perfil eliminado",
  perfil_asignado: "Perfil asignado",
  permisos_usuario_guardados: "Permisos de usuario guardados",
  ajuste_guardado: "Ajuste global guardado",
  cliente_creado: "Cliente creado",
  cliente_editado: "Cliente editado",
  cliente_eliminado: "Cliente eliminado",
  cliente_restaurado: "Cliente restaurado",
  cliente_invitacion: "Invitación de cliente enviada",
  proyecto_creado: "Proyecto creado",
  proyecto_editado: "Proyecto editado",
  proyecto_eliminado: "Proyecto eliminado",
  proyecto_restaurado: "Proyecto restaurado",
  proyecto_terminado: "Proyecto terminado",
  proyecto_archivado: "Proyecto archivado",
  proyecto_reactivado: "Proyecto reactivado",
  proyectos_archivados_lote: "Proyectos terminados archivados",
  tipo_creado: "Tipo de proyecto creado",
  tipo_renombrado: "Tipo de proyecto renombrado",
  tipo_eliminado: "Tipo de proyecto eliminado",
  apartado_creado: "Apartado creado",
  apartado_borrado: "Apartado borrado",
  tarea_creada: "Tarea creada",
  tarea_editada: "Tarea editada",
  tarea_borrada: "Tarea borrada",
  tarea_restaurada: "Tarea restaurada",
  tarea_movida: "Tarea movida",
  tarea_responsables: "Responsables de tarea actualizados",
};

const AREA_ETIQUETAS: Record<LogArea, string> = {
  admin: "Admin",
  clientes: "Clientes",
  proyectos: "Proyectos",
  tareas: "Tareas",
};

function textoValor(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  return String(v);
}

/** Resumen legible de alta: «Cliente "GPA" · correo: a@b · origen: manual». */
export function formatearAlta(
  titulo: string,
  campos: Array<{ campo: string; valor: unknown }>,
): string {
  const partes = campos
    .filter((c) => c.valor != null && String(c.valor).trim() !== "")
    .map((c) => `${c.campo}: ${textoValor(c.valor)}`);
  return partes.length ? `${titulo} · ${partes.join(" · ")}`.slice(0, 500) : titulo.slice(0, 500);
}

/** Diff de campos: «nombre: GPA → GPa · origen: manual → clientify». */
export function formatearCambios(
  titulo: string,
  cambios: Array<{ campo: string; de: unknown; a: unknown }>,
): string {
  const partes = cambios
    .filter((c) => textoValor(c.de) !== textoValor(c.a))
    .map((c) => `${c.campo}: ${textoValor(c.de)} → ${textoValor(c.a)}`);
  const cuerpo = partes.length ? partes.join(" · ") : "sin cambios de campos";
  return `${titulo} · ${cuerpo}`.slice(0, 500);
}

export function etiquetaAccion(accion: string): string {
  return ETIQUETAS[accion] ?? accion;
}

export function etiquetaArea(area: LogArea): string {
  return AREA_ETIQUETAS[area];
}

export function areaDeAccion(accion: string): LogArea {
  if (
    accion.startsWith("cliente_") ||
    accion === "cliente_invitacion"
  ) {
    return "clientes";
  }
  if (
    accion.startsWith("proyecto_") ||
    accion.startsWith("proyectos_") ||
    accion.startsWith("tipo_")
  ) {
    return "proyectos";
  }
  if (accion.startsWith("tarea_") || accion.startsWith("apartado_")) {
    return "tareas";
  }
  return "admin";
}

export async function registrarAdminLog(input: {
  actorId: string | null;
  actorCorreo: string;
  accion: string;
  detalle?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const pool = await getPool();
    const id = randomUUID();
    const detalle = input.detalle?.trim().slice(0, 500) || null;
    const meta = {
      area: areaDeAccion(input.accion),
      ...(input.meta ?? {}),
    };
    await pool.execute(
      `INSERT INTO admin_logs (id, actor_id, actor_correo, accion, detalle, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.actorId,
        input.actorCorreo.trim().toLowerCase().slice(0, 255),
        input.accion.slice(0, 64),
        detalle,
        JSON.stringify(meta),
      ],
    );
  } catch (error) {
    console.error("[admin_logs] no se pudo registrar", {
      accion: input.accion,
      error,
    });
  }
}

/** Atajo tipado con actor de sesión. */
export async function logActividad(
  actor: { id: string; correo: string },
  accion: string,
  detalle?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  await registrarAdminLog({
    actorId: actor.id,
    actorCorreo: actor.correo,
    accion,
    detalle,
    meta,
  });
}

type LogRow = RowDataPacket & {
  id: string;
  actor_id: string | null;
  actor_correo: string;
  accion: string;
  detalle: string | null;
  meta_json: unknown;
  creado_en: Date;
  nota: string | null;
  nota_autor_id: string | null;
  nota_autor_nombre: string | null;
  nota_creado_en: Date | string | null;
};

function mapearLog(r: LogRow): AdminLogEntry {
  return {
    id: r.id,
    actorId: r.actor_id,
    actorCorreo: r.actor_correo,
    accion: r.accion,
    detalle: r.detalle,
    metaJson: r.meta_json,
    creadoEn: r.creado_en,
    nota: r.nota,
    notaAutorId: r.nota_autor_id,
    notaAutorNombre: r.nota_autor_nombre,
    notaCreadoEn: r.nota_creado_en
      ? r.nota_creado_en instanceof Date
        ? r.nota_creado_en
        : new Date(r.nota_creado_en)
      : null,
  };
}

export async function listarAdminLogs(opts?: {
  limit?: number;
  actorId?: string | null;
  area?: LogArea | null;
}): Promise<AdminLogEntry[]> {
  const pool = await getPool();
  const lim = Math.min(Math.max(1, opts?.limit ?? 200), 500);
  const params: unknown[] = [];
  const where: string[] = [];

  if (opts?.actorId) {
    where.push("l.actor_id = ?");
    params.push(opts.actorId);
  }

  if (opts?.area) {
    // Prefijos por área (sin depender solo de meta_json legacy).
    if (opts.area === "clientes") {
      where.push("l.accion LIKE 'cliente_%'");
    } else if (opts.area === "proyectos") {
      where.push("(l.accion LIKE 'proyecto_%' OR l.accion LIKE 'proyectos_%' OR l.accion LIKE 'tipo_%')");
    } else if (opts.area === "tareas") {
      where.push("(l.accion LIKE 'tarea_%' OR l.accion LIKE 'apartado_%')");
    } else {
      where.push(
        "l.accion NOT LIKE 'cliente_%' AND l.accion NOT LIKE 'proyecto_%' AND l.accion NOT LIKE 'proyectos_%' AND l.accion NOT LIKE 'tipo_%' AND l.accion NOT LIKE 'tarea_%' AND l.accion NOT LIKE 'apartado_%'",
      );
    }
  }

  const sql = `
    SELECT l.id, l.actor_id, l.actor_correo, l.accion, l.detalle, l.meta_json, l.creado_en,
           l.nota, l.nota_autor_id, l.nota_creado_en, u.nombre AS nota_autor_nombre
    FROM admin_logs l
    LEFT JOIN usuarios u ON u.id = l.nota_autor_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY l.creado_en DESC
    LIMIT ${lim}`;

  const [rows] = await pool.query<LogRow[]>(sql, params);
  return rows.map(mapearLog);
}

/** Logs cuyo meta apunta a cliente / proyecto / tarea (para historial de ficha). */
export async function listarLogsPorMetaIds(opts: {
  clienteIds?: string[];
  proyectoIds?: string[];
  tareaIds?: string[];
  limit?: number;
}): Promise<AdminLogEntry[]> {
  const clienteIds = (opts.clienteIds ?? []).map((id) => id.trim()).filter(Boolean);
  const proyectoIds = (opts.proyectoIds ?? []).map((id) => id.trim()).filter(Boolean);
  const tareaIds = (opts.tareaIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (clienteIds.length === 0 && proyectoIds.length === 0 && tareaIds.length === 0) {
    return [];
  }

  const pool = await getPool();
  const lim = Math.min(Math.max(1, opts.limit ?? 200), 500);
  const where: string[] = [];
  const params: unknown[] = [];

  if (clienteIds.length === 1) {
    where.push(`JSON_UNQUOTE(JSON_EXTRACT(l.meta_json, '$.clienteId')) = ?`);
    params.push(clienteIds[0]);
  } else if (clienteIds.length > 1) {
    where.push(
      `JSON_UNQUOTE(JSON_EXTRACT(l.meta_json, '$.clienteId')) IN (${clienteIds.map(() => "?").join(",")})`,
    );
    params.push(...clienteIds);
  }

  if (proyectoIds.length === 1) {
    where.push(`JSON_UNQUOTE(JSON_EXTRACT(l.meta_json, '$.proyectoId')) = ?`);
    params.push(proyectoIds[0]);
  } else if (proyectoIds.length > 1) {
    where.push(
      `JSON_UNQUOTE(JSON_EXTRACT(l.meta_json, '$.proyectoId')) IN (${proyectoIds.map(() => "?").join(",")})`,
    );
    params.push(...proyectoIds);
  }

  if (tareaIds.length === 1) {
    where.push(`JSON_UNQUOTE(JSON_EXTRACT(l.meta_json, '$.tareaId')) = ?`);
    params.push(tareaIds[0]);
  } else if (tareaIds.length > 1) {
    where.push(
      `JSON_UNQUOTE(JSON_EXTRACT(l.meta_json, '$.tareaId')) IN (${tareaIds.map(() => "?").join(",")})`,
    );
    params.push(...tareaIds);
  }

  const sql = `
    SELECT l.id, l.actor_id, l.actor_correo, l.accion, l.detalle, l.meta_json, l.creado_en,
           l.nota, l.nota_autor_id, l.nota_creado_en, u.nombre AS nota_autor_nombre
    FROM admin_logs l
    LEFT JOIN usuarios u ON u.id = l.nota_autor_id
    WHERE ${where.join(" OR ")}
    ORDER BY l.creado_en DESC
    LIMIT ${lim}`;

  const [rows] = await pool.query<LogRow[]>(sql, params);
  return rows.map(mapearLog);
}

export async function guardarNotaAdminLog(
  logId: string,
  texto: string,
  autorId: string,
  autorNombre: string,
): Promise<
  | { ok: true; nota: string | null; notaAutorNombre: string | null; notaCreadoEn: Date | null }
  | { ok: false; motivo: "no_encontrado" | "falta_dato" }
> {
  const id = logId.trim();
  if (!id || !autorId.trim()) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [exist] = await pool.execute<(RowDataPacket & { id: string })[]>(
    "SELECT id FROM admin_logs WHERE id = ? LIMIT 1",
    [id],
  );
  if (!exist[0]) return { ok: false, motivo: "no_encontrado" };

  const limpio = texto.slice(0, NOTA_MAX).trim();
  if (!limpio) {
    await pool.execute(
      `UPDATE admin_logs SET nota = NULL, nota_autor_id = NULL, nota_creado_en = NULL WHERE id = ?`,
      [id],
    );
    return { ok: true, nota: null, notaAutorNombre: null, notaCreadoEn: null };
  }

  const ahora = new Date();
  await pool.execute(
    `UPDATE admin_logs SET nota = ?, nota_autor_id = ?, nota_creado_en = ? WHERE id = ?`,
    [limpio, autorId.trim(), ahora, id],
  );
  return {
    ok: true,
    nota: limpio,
    notaAutorNombre: autorNombre.trim() || null,
    notaCreadoEn: ahora,
  };
}
