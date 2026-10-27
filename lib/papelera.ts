import { randomUUID } from "crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "@/lib/db";
import type { Permiso } from "@/lib/permisos";
import { usuarioPuede, type UsuarioAuth } from "@/lib/usuarios";

export const DIAS_RETENCION_PAPELERA = 30;

export type TipoEliminacion = "tarea" | "proyecto" | "cliente";

export type ActorPapelera = { id: string; correo: string };

export type EliminacionLista = {
  id: string;
  batchId: string;
  tipo: TipoEliminacion;
  entidadId: string;
  etiqueta: string;
  actorCorreo: string;
  eliminadoEn: string;
  expiraEn: string;
};

export type MotivoPapelera =
  | "no_encontrado"
  | "ya_restaurado"
  | "expirado"
  | "conflicto"
  | "dependencia_faltante"
  | "sin_permiso";

type ElimRow = RowDataPacket & {
  id: string;
  batch_id: string;
  tipo: TipoEliminacion;
  entidad_id: string;
  etiqueta: string;
  snapshot_json: unknown;
  actor_id: string | null;
  actor_correo: string;
  eliminado_en: Date | string;
  restaurado_en: Date | string | null;
  expira_en: Date | string;
};

type SnapTarea = {
  tarea: Record<string, unknown>;
  checklist: Record<string, unknown>[];
  adjuntos: Record<string, unknown>[];
  mensajes: Record<string, unknown>[];
  chatVistos: Record<string, unknown>[];
  vistas: Record<string, unknown>[];
};

type SnapProyecto = {
  proyecto: Record<string, unknown>;
  miembros: Record<string, unknown>[];
  columnas: Record<string, unknown>[];
  columnasOcultas: Record<string, unknown>[];
  favoritos: Record<string, unknown>[];
  asignacionesVistas: Record<string, unknown>[];
  notas: Record<string, unknown>[];
  sugerencias: Record<string, unknown>[];
  tareas: SnapTarea[];
};

type SnapCliente = {
  cliente: Record<string, unknown>;
  notas: Record<string, unknown>[];
  proyectos: SnapProyecto[];
  conversacionesBorradas: number;
};

function iso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function asRecords(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(asRecord) : [];
}

function jsonVal(v: unknown): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v ?? null);
}

function fechaSql(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") return v.slice(0, 26).replace("T", " ").replace("Z", "");
  if (v instanceof Date) return v.toISOString().slice(0, 23).replace("T", " ");
  return String(v);
}

function fechaDiaSql(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).slice(0, 10);
}

function permisoDeTipo(tipo: TipoEliminacion): Permiso {
  if (tipo === "tarea") return "tareas.editar";
  if (tipo === "proyecto") return "proyectos.editar";
  return "clientes.editar";
}

export function puedeGestionarPapelera(usuario: UsuarioAuth): boolean {
  return (
    usuarioPuede(usuario, "tareas.editar") ||
    usuarioPuede(usuario, "proyectos.editar") ||
    usuarioPuede(usuario, "clientes.editar")
  );
}

export function puedeRestaurarTipo(usuario: UsuarioAuth, tipo: TipoEliminacion): boolean {
  return usuarioPuede(usuario, permisoDeTipo(tipo));
}

type SqlParam = string | number | boolean | Date | null;

function sqlParams(values: readonly unknown[]): SqlParam[] {
  return values.map((v): SqlParam => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
    if (v instanceof Date) return v;
    return String(v);
  });
}

async function exec(
  conn: PoolConnection,
  sql: string,
  values: readonly unknown[] = [],
): Promise<void> {
  await conn.execute(sql, sqlParams(values));
}

async function queryRows(
  conn: PoolConnection,
  sql: string,
  values: readonly unknown[] = [],
): Promise<RowDataPacket[]> {
  const [rows] = await conn.execute<RowDataPacket[]>(sql, sqlParams(values));
  return rows;
}

async function filas(
  conn: PoolConnection | Awaited<ReturnType<typeof getPool>>,
  sql: string,
  params: readonly unknown[] = [],
): Promise<Record<string, unknown>[]> {
  try {
    const [rows] = await conn.execute<RowDataPacket[]>(sql, sqlParams(params));
    return rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (k === "constructor") continue;
        out[k] = v instanceof Date ? v.toISOString() : v;
      }
      return out;
    });
  } catch (err) {
    // Sandbox / BD incompleta: no tumbar el borrado por tablas opcionales ausentes.
    if ((err as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw err;
  }
}

async function snapshotTarea(
  conn: PoolConnection | Awaited<ReturnType<typeof getPool>>,
  tareaId: string,
): Promise<SnapTarea | null> {
  const tareas = await filas(
    conn,
    `SELECT id, proyecto_id, columna_id, nombre, fecha_prevista, fecha_maxima,
            sync_calendar, notificar_asignado, calendar_event_id, mandada_por_id, responsable_ids,
            prioridad, dificultad, notas, notas_autor_id, notas_creado_en, completada_en, orden, creado_en
     FROM tareas WHERE id = ? LIMIT 1`,
    [tareaId],
  );
  if (tareas.length === 0) return null;
  const [checklist, adjuntos, mensajes, chatVistos, vistas] = await Promise.all([
    filas(
      conn,
      `SELECT id, tarea_id, texto, hecho, orden, creado_en, actualizado_en
       FROM tarea_checklist WHERE tarea_id = ? ORDER BY orden`,
      [tareaId],
    ),
    filas(
      conn,
      `SELECT id, mensaje_id, tarea_id, gcs_object, nombre, mime, tamano_bytes, creado_en
       FROM adjuntos WHERE tarea_id = ?`,
      [tareaId],
    ),
    filas(
      conn,
      `SELECT id, tarea_id, autor_id, cuerpo, creado_en FROM tarea_mensajes WHERE tarea_id = ?`,
      [tareaId],
    ),
    filas(conn, `SELECT tarea_id, usuario_id, visto_en FROM tarea_chat_vistos WHERE tarea_id = ?`, [
      tareaId,
    ]),
    filas(conn, `SELECT tarea_id, usuario_id, visto_en FROM tareas_vistas WHERE tarea_id = ?`, [
      tareaId,
    ]),
  ]);
  return { tarea: tareas[0]!, checklist, adjuntos, mensajes, chatVistos, vistas };
}

async function snapshotProyecto(
  conn: PoolConnection | Awaited<ReturnType<typeof getPool>>,
  proyectoId: string,
): Promise<SnapProyecto | null> {
  const proyectos = await filas(
    conn,
    `SELECT id, ambito, nombre, cliente_id, tipo_id, fee_mensual, fin_contrato,
            responsable_id, prioridad, estado, personal_de_id, creado_en
     FROM proyectos WHERE id = ? LIMIT 1`,
    [proyectoId],
  );
  if (proyectos.length === 0) return null;

  const [
    miembros,
    columnas,
    columnasOcultas,
    favoritos,
    asignacionesVistas,
    notas,
    sugerencias,
    tareaIds,
  ] = await Promise.all([
    filas(
      conn,
      `SELECT proyecto_id, usuario_id, asignado_en FROM proyecto_miembros WHERE proyecto_id = ?`,
      [proyectoId],
    ),
    filas(
      conn,
      `SELECT id, proyecto_id, nombre, fija, orden, creado_en FROM columnas WHERE proyecto_id = ? ORDER BY orden`,
      [proyectoId],
    ),
    filas(
      conn,
      `SELECT cou.usuario_id, cou.columna_id
       FROM columnas_ocultas_usuario cou
       INNER JOIN columnas c ON c.id = cou.columna_id
       WHERE c.proyecto_id = ?`,
      [proyectoId],
    ),
    filas(
      conn,
      `SELECT usuario_id, proyecto_id, creado_en FROM proyecto_favoritos WHERE proyecto_id = ?`,
      [proyectoId],
    ),
    filas(
      conn,
      `SELECT proyecto_id, usuario_id, visto_en FROM asignaciones_vistas WHERE proyecto_id = ?`,
      [proyectoId],
    ),
    filas(
      conn,
      `SELECT id, texto, autor_id, creado_en, actualizado_en, proyecto_id, cliente_id
       FROM notas WHERE proyecto_id = ?`,
      [proyectoId],
    ),
    filas(
      conn,
      `SELECT id, autor_id, titulo, texto, tarea_id, proyecto_id, estado, creado_en
       FROM sugerencias WHERE proyecto_id = ?`,
      [proyectoId],
    ),
    filas(conn, `SELECT id FROM tareas WHERE proyecto_id = ?`, [proyectoId]),
  ]);

  const tareas: SnapTarea[] = [];
  for (const row of tareaIds) {
    const snap = await snapshotTarea(conn, String(row.id));
    if (snap) tareas.push(snap);
  }

  return {
    proyecto: proyectos[0]!,
    miembros,
    columnas,
    columnasOcultas,
    favoritos,
    asignacionesVistas,
    notas,
    sugerencias,
    tareas,
  };
}

async function snapshotCliente(
  conn: PoolConnection | Awaited<ReturnType<typeof getPool>>,
  clienteId: string,
): Promise<SnapCliente | null> {
  const clientes = await filas(
    conn,
    `SELECT id, nombre, correo_acceso, telefono, responsable_id, origen,
            invitacion_enviada, invitacion_enviada_en, creado_en
     FROM clientes WHERE id = ? LIMIT 1`,
    [clienteId],
  );
  if (clientes.length === 0) return null;

  const [notas, proyectoIds, convCount] = await Promise.all([
    filas(
      conn,
      `SELECT id, texto, autor_id, creado_en, actualizado_en, proyecto_id, cliente_id
       FROM notas WHERE cliente_id = ? AND proyecto_id IS NULL`,
      [clienteId],
    ),
    filas(conn, `SELECT id FROM proyectos WHERE cliente_id = ?`, [clienteId]),
    filas(conn, `SELECT COUNT(*) AS n FROM conversaciones WHERE cliente_id = ?`, [clienteId]),
  ]);

  const proyectos: SnapProyecto[] = [];
  for (const row of proyectoIds) {
    const snap = await snapshotProyecto(conn, String(row.id));
    if (snap) proyectos.push(snap);
  }

  return {
    cliente: clientes[0]!,
    notas,
    proyectos,
    conversacionesBorradas: Number(convCount[0]?.n ?? 0),
  };
}

async function guardarEliminacion(
  conn: PoolConnection,
  input: {
    tipo: TipoEliminacion;
    entidadId: string;
    etiqueta: string;
    snapshot: unknown;
    actor: ActorPapelera;
    batchId?: string;
  },
): Promise<{ id: string; batchId: string }> {
  const id = randomUUID();
  const batchId = input.batchId ?? id;
  await exec(
    conn,
    `INSERT INTO eliminaciones
      (id, batch_id, tipo, entidad_id, etiqueta, snapshot_json, actor_id, actor_correo, eliminado_en, expira_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${DIAS_RETENCION_PAPELERA} DAY))`,
    [
      id,
      batchId,
      input.tipo,
      input.entidadId,
      input.etiqueta.slice(0, 500),
      JSON.stringify(input.snapshot),
      input.actor.id,
      input.actor.correo.slice(0, 320),
    ],
  );
  return { id, batchId };
}

async function hardDeleteProyecto(conn: PoolConnection, proyectoId: string) {
  await exec(conn, "DELETE FROM tareas WHERE proyecto_id = ?", [proyectoId]);
  await exec(conn, "DELETE FROM columnas WHERE proyecto_id = ?", [proyectoId]);
  await exec(conn, "DELETE FROM proyectos WHERE id = ?", [proyectoId]);
}

async function restaurarTareaSnap(conn: PoolConnection, snap: SnapTarea): Promise<MotivoPapelera | null> {
  const t = snap.tarea;
  const id = String(t.id ?? "");
  if (!id) return "no_encontrado";

  const exist = await queryRows(conn, "SELECT id FROM tareas WHERE id = ? LIMIT 1", [id]);
  if (exist.length > 0) return "conflicto";

  const proy = await queryRows(conn, "SELECT id FROM proyectos WHERE id = ? LIMIT 1", [
    String(t.proyecto_id),
  ]);
  if (proy.length === 0) return "dependencia_faltante";

  const col = await queryRows(conn, "SELECT id FROM columnas WHERE id = ? LIMIT 1", [
    String(t.columna_id),
  ]);
  if (col.length === 0) return "dependencia_faltante";

  await exec(
    conn,
    `INSERT INTO tareas
      (id, proyecto_id, columna_id, nombre, fecha_prevista, fecha_maxima, sync_calendar,
       notificar_asignado, calendar_event_id, mandada_por_id, responsable_ids, prioridad,
       dificultad, notas, notas_autor_id, notas_creado_en, completada_en, orden, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      t.proyecto_id,
      t.columna_id,
      t.nombre,
      fechaDiaSql(t.fecha_prevista),
      fechaDiaSql(t.fecha_maxima),
      t.sync_calendar ? 1 : 0,
      t.notificar_asignado ? 1 : 0,
      t.calendar_event_id ?? null,
      t.mandada_por_id ?? null,
      jsonVal(t.responsable_ids ?? []),
      t.prioridad ?? "media",
      Number(t.dificultad ?? 3),
      t.notas ?? null,
      t.notas_autor_id ?? null,
      fechaSql(t.notas_creado_en as string | null),
      fechaSql(t.completada_en as string | null),
      Number(t.orden ?? 0),
      fechaSql(t.creado_en as string) ?? fechaSql(new Date()),
    ],
  );

  for (const c of snap.checklist) {
    await exec(
      conn,
      `INSERT IGNORE INTO tarea_checklist
        (id, tarea_id, texto, hecho, orden, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        id,
        c.texto,
        c.hecho ? 1 : 0,
        Number(c.orden ?? 0),
        fechaSql(c.creado_en as string) ?? fechaSql(new Date()),
        fechaSql(c.actualizado_en as string) ?? fechaSql(new Date()),
      ],
    );
  }

  for (const a of snap.adjuntos) {
    await exec(
      conn,
      `INSERT IGNORE INTO adjuntos
        (id, mensaje_id, tarea_id, gcs_object, nombre, mime, tamano_bytes, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.mensaje_id ?? null,
        id,
        a.gcs_object,
        a.nombre,
        a.mime ?? null,
        a.tamano_bytes ?? null,
        fechaSql(a.creado_en as string) ?? fechaSql(new Date()),
      ],
    );
  }

  for (const m of snap.mensajes) {
    await exec(
      conn,
      `INSERT IGNORE INTO tarea_mensajes (id, tarea_id, autor_id, cuerpo, creado_en)
       VALUES (?, ?, ?, ?, ?)`,
      [
        m.id,
        id,
        m.autor_id,
        m.cuerpo,
        fechaSql(m.creado_en as string) ?? fechaSql(new Date()),
      ],
    );
  }

  for (const v of snap.chatVistos) {
    await exec(
      conn,
      `INSERT IGNORE INTO tarea_chat_vistos (tarea_id, usuario_id, visto_en) VALUES (?, ?, ?)`,
      [id, v.usuario_id, fechaSql(v.visto_en as string) ?? fechaSql(new Date())],
    );
  }

  for (const v of snap.vistas) {
    await exec(
      conn,
      `INSERT IGNORE INTO tareas_vistas (tarea_id, usuario_id, visto_en) VALUES (?, ?, ?)`,
      [id, v.usuario_id, fechaSql(v.visto_en as string) ?? fechaSql(new Date())],
    );
  }

  return null;
}

async function restaurarProyectoSnap(
  conn: PoolConnection,
  snap: SnapProyecto,
): Promise<MotivoPapelera | null> {
  const p = snap.proyecto;
  const id = String(p.id ?? "");
  if (!id) return "no_encontrado";

  const exist = await queryRows(conn, "SELECT id FROM proyectos WHERE id = ? LIMIT 1", [id]);
  if (exist.length > 0) return "conflicto";

  if (p.cliente_id) {
    const cli = await queryRows(conn, "SELECT id FROM clientes WHERE id = ? LIMIT 1", [
      String(p.cliente_id),
    ]);
    if (cli.length === 0) return "dependencia_faltante";
  }

  if (p.tipo_id) {
    const tipo = await queryRows(conn, "SELECT id FROM tipos_proyecto WHERE id = ? LIMIT 1", [
      String(p.tipo_id),
    ]);
    if (tipo.length === 0) return "dependencia_faltante";
  }

  await exec(
    conn,
    `INSERT INTO proyectos
      (id, ambito, nombre, cliente_id, tipo_id, fee_mensual, fin_contrato,
       responsable_id, prioridad, estado, personal_de_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      p.ambito,
      p.nombre ?? null,
      p.cliente_id ?? null,
      p.tipo_id ?? null,
      p.fee_mensual ?? null,
      fechaDiaSql(p.fin_contrato),
      p.responsable_id ?? null,
      p.prioridad ?? "media",
      p.estado ?? "activo",
      p.personal_de_id ?? null,
      fechaSql(p.creado_en as string) ?? fechaSql(new Date()),
    ],
  );

  for (const c of snap.columnas) {
    await exec(
      conn,
      `INSERT INTO columnas (id, proyecto_id, nombre, fija, orden, creado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        id,
        c.nombre,
        c.fija ? 1 : 0,
        Number(c.orden ?? 0),
        fechaSql(c.creado_en as string) ?? fechaSql(new Date()),
      ],
    );
  }

  for (const t of snap.tareas) {
    const err = await restaurarTareaSnap(conn, t);
    if (err) return err;
  }

  for (const m of snap.miembros) {
    await exec(
      conn,
      `INSERT IGNORE INTO proyecto_miembros (proyecto_id, usuario_id, asignado_en)
       VALUES (?, ?, ?)`,
      [id, m.usuario_id, fechaSql(m.asignado_en as string) ?? fechaSql(new Date())],
    );
  }

  for (const o of snap.columnasOcultas) {
    await exec(
      conn,
      `INSERT IGNORE INTO columnas_ocultas_usuario (usuario_id, columna_id) VALUES (?, ?)`,
      [o.usuario_id, o.columna_id],
    );
  }

  for (const f of snap.favoritos) {
    await exec(
      conn,
      `INSERT IGNORE INTO proyecto_favoritos (usuario_id, proyecto_id, creado_en) VALUES (?, ?, ?)`,
      [f.usuario_id, id, fechaSql(f.creado_en as string) ?? fechaSql(new Date())],
    );
  }

  for (const a of snap.asignacionesVistas) {
    await exec(
      conn,
      `INSERT IGNORE INTO asignaciones_vistas (proyecto_id, usuario_id, visto_en) VALUES (?, ?, ?)`,
      [id, a.usuario_id, fechaSql(a.visto_en as string) ?? fechaSql(new Date())],
    );
  }

  for (const n of snap.notas) {
    await exec(
      conn,
      `INSERT IGNORE INTO notas
        (id, texto, autor_id, creado_en, actualizado_en, proyecto_id, cliente_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        n.id,
        n.texto,
        n.autor_id,
        fechaSql(n.creado_en as string) ?? fechaSql(new Date()),
        fechaSql(n.actualizado_en as string) ?? fechaSql(new Date()),
        id,
        n.cliente_id ?? null,
      ],
    );
  }

  for (const s of snap.sugerencias) {
    await exec(
      conn,
      `INSERT IGNORE INTO sugerencias
        (id, autor_id, titulo, texto, tarea_id, proyecto_id, estado, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.autor_id,
        s.titulo,
        s.texto ?? null,
        s.tarea_id ?? null,
        id,
        s.estado ?? "pendiente",
        fechaSql(s.creado_en as string) ?? fechaSql(new Date()),
      ],
    );
  }

  return null;
}

async function restaurarClienteSnap(
  conn: PoolConnection,
  snap: SnapCliente,
): Promise<MotivoPapelera | null> {
  const c = snap.cliente;
  const id = String(c.id ?? "");
  if (!id) return "no_encontrado";

  const exist = await queryRows(conn, "SELECT id FROM clientes WHERE id = ? LIMIT 1", [id]);
  if (exist.length > 0) return "conflicto";

  const dup = await queryRows(
    conn,
    `SELECT id FROM clientes
     WHERE correo_acceso = ? OR nombre = ? LIMIT 1`,
    [c.correo_acceso, c.nombre],
  );
  if (dup.length > 0) return "conflicto";

  try {
    await exec(
      conn,
      `INSERT INTO clientes
        (id, nombre, correo_acceso, telefono, responsable_id, origen,
         invitacion_enviada, invitacion_enviada_en, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        c.nombre,
        c.correo_acceso,
        c.telefono ?? null,
        c.responsable_id ?? null,
        c.origen ?? "manual",
        c.invitacion_enviada ? 1 : 0,
        fechaSql(c.invitacion_enviada_en as string | null),
        fechaSql(c.creado_en as string) ?? fechaSql(new Date()),
      ],
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") return "conflicto";
    throw err;
  }

  for (const n of snap.notas) {
    await exec(
      conn,
      `INSERT IGNORE INTO notas
        (id, texto, autor_id, creado_en, actualizado_en, proyecto_id, cliente_id)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [
        n.id,
        n.texto,
        n.autor_id,
        fechaSql(n.creado_en as string) ?? fechaSql(new Date()),
        fechaSql(n.actualizado_en as string) ?? fechaSql(new Date()),
        id,
      ],
    );
  }

  for (const p of snap.proyectos) {
    const err = await restaurarProyectoSnap(conn, p);
    if (err) return err;
  }

  return null;
}

function parseSnapshot(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export async function eliminarTareaConPapelera(
  tareaId: string,
  actor: ActorPapelera,
): Promise<
  | { ok: true; eliminacionId: string; etiqueta: string; proyectoId: string }
  | { ok: false; motivo: "no_encontrado" }
> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const snap = await snapshotTarea(conn, tareaId);
    if (!snap) {
      await conn.rollback();
      return { ok: false, motivo: "no_encontrado" };
    }
    const etiqueta = String(snap.tarea.nombre ?? tareaId).slice(0, 500);
    const { id } = await guardarEliminacion(conn, {
      tipo: "tarea",
      entidadId: tareaId,
      etiqueta,
      snapshot: snap,
      actor,
    });
    await conn.execute("DELETE FROM tareas WHERE id = ?", [tareaId]);
    await conn.commit();
    return {
      ok: true,
      eliminacionId: id,
      etiqueta,
      proyectoId: String(snap.tarea.proyecto_id),
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function eliminarProyectoConPapelera(
  proyectoId: string,
  actor: ActorPapelera,
): Promise<
  | { ok: true; eliminacionId: string; etiqueta: string }
  | { ok: false; motivo: "no_encontrado" }
> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const snap = await snapshotProyecto(conn, proyectoId);
    if (!snap) {
      await conn.rollback();
      return { ok: false, motivo: "no_encontrado" };
    }
    const etiqueta = String(
      snap.proyecto.nombre?.toString().trim() || proyectoId.slice(0, 8),
    ).slice(0, 500);
    const { id } = await guardarEliminacion(conn, {
      tipo: "proyecto",
      entidadId: proyectoId,
      etiqueta,
      snapshot: snap,
      actor,
    });
    await hardDeleteProyecto(conn, proyectoId);
    await conn.commit();
    return { ok: true, eliminacionId: id, etiqueta };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function eliminarClienteConPapelera(
  clienteId: string,
  actor: ActorPapelera,
): Promise<
  | {
      ok: true;
      eliminacionId: string;
      etiqueta: string;
      proyectosBorrados: number;
      conversacionesBorradas: number;
    }
  | { ok: false; motivo: "no_encontrado" }
> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const snap = await snapshotCliente(conn, clienteId);
    if (!snap) {
      await conn.rollback();
      return { ok: false, motivo: "no_encontrado" };
    }
    const etiqueta = String(snap.cliente.nombre ?? clienteId).slice(0, 500);
    const { id } = await guardarEliminacion(conn, {
      tipo: "cliente",
      entidadId: clienteId,
      etiqueta,
      snapshot: snap,
      actor,
    });

    // conversaciones.cliente_id es RESTRICT: hay que borrarlas (no se restauran).
    await conn.execute("DELETE FROM conversaciones WHERE cliente_id = ?", [clienteId]);

    for (const p of snap.proyectos) {
      await hardDeleteProyecto(conn, String(p.proyecto.id));
    }
    await conn.execute("DELETE FROM clientes WHERE id = ?", [clienteId]);
    await conn.commit();
    return {
      ok: true,
      eliminacionId: id,
      etiqueta,
      proyectosBorrados: snap.proyectos.length,
      conversacionesBorradas: snap.conversacionesBorradas,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function listarEliminaciones(
  usuario: UsuarioAuth,
  opts?: { tipo?: TipoEliminacion; limite?: number },
): Promise<EliminacionLista[]> {
  if (!puedeGestionarPapelera(usuario)) return [];
  await purgarEliminacionesExpiradas();

  const tipos: TipoEliminacion[] = [];
  if (usuarioPuede(usuario, "tareas.editar")) tipos.push("tarea");
  if (usuarioPuede(usuario, "proyectos.editar")) tipos.push("proyecto");
  if (usuarioPuede(usuario, "clientes.editar")) tipos.push("cliente");
  if (opts?.tipo) {
    if (!tipos.includes(opts.tipo)) return [];
    tipos.length = 0;
    tipos.push(opts.tipo);
  }
  if (tipos.length === 0) return [];

  const limite = Math.min(Math.max(opts?.limite ?? 100, 1), 200);
  const placeholders = tipos.map(() => "?").join(",");
  const pool = await getPool();
  const [rows] = await pool.execute<ElimRow[]>(
    `SELECT id, batch_id, tipo, entidad_id, etiqueta, actor_correo,
            eliminado_en, expira_en
     FROM eliminaciones
     WHERE restaurado_en IS NULL
       AND expira_en > UTC_TIMESTAMP(3)
       AND tipo IN (${placeholders})
     ORDER BY eliminado_en DESC
     LIMIT ${limite}`,
    tipos,
  );

  return rows.map((r) => ({
    id: r.id,
    batchId: r.batch_id,
    tipo: r.tipo,
    entidadId: r.entidad_id,
    etiqueta: r.etiqueta,
    actorCorreo: r.actor_correo,
    eliminadoEn: iso(r.eliminado_en) ?? new Date().toISOString(),
    expiraEn: iso(r.expira_en) ?? new Date().toISOString(),
  }));
}

export async function obtenerEliminacion(
  id: string,
): Promise<(EliminacionLista & { tipo: TipoEliminacion; snapshot: unknown }) | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<ElimRow[]>(
    `SELECT id, batch_id, tipo, entidad_id, etiqueta, snapshot_json, actor_correo,
            eliminado_en, restaurado_en, expira_en
     FROM eliminaciones WHERE id = ? LIMIT 1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    batchId: r.batch_id,
    tipo: r.tipo,
    entidadId: r.entidad_id,
    etiqueta: r.etiqueta,
    actorCorreo: r.actor_correo,
    eliminadoEn: iso(r.eliminado_en) ?? new Date().toISOString(),
    expiraEn: iso(r.expira_en) ?? new Date().toISOString(),
    snapshot: parseSnapshot(r.snapshot_json),
  };
}

export async function restaurarEliminacion(
  eliminacionId: string,
  usuario: UsuarioAuth,
): Promise<
  | { ok: true; tipo: TipoEliminacion; entidadId: string; etiqueta: string }
  | { ok: false; motivo: MotivoPapelera }
> {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute<ElimRow[]>(
      `SELECT id, batch_id, tipo, entidad_id, etiqueta, snapshot_json,
              eliminado_en, restaurado_en, expira_en
       FROM eliminaciones WHERE id = ? LIMIT 1 FOR UPDATE`,
      [eliminacionId],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { ok: false, motivo: "no_encontrado" };
    }
    if (row.restaurado_en) {
      await conn.rollback();
      return { ok: false, motivo: "ya_restaurado" };
    }
    const expira = new Date(row.expira_en);
    if (Number.isNaN(expira.getTime()) || expira.getTime() < Date.now()) {
      await conn.rollback();
      return { ok: false, motivo: "expirado" };
    }
    if (!puedeRestaurarTipo(usuario, row.tipo)) {
      await conn.rollback();
      return { ok: false, motivo: "sin_permiso" };
    }

    const snap = parseSnapshot(row.snapshot_json);
    let err: MotivoPapelera | null = null;
    if (row.tipo === "tarea") {
      err = await restaurarTareaSnap(conn, {
        tarea: asRecord(asRecord(snap).tarea ?? snap),
        checklist: asRecords(asRecord(snap).checklist),
        adjuntos: asRecords(asRecord(snap).adjuntos),
        mensajes: asRecords(asRecord(snap).mensajes),
        chatVistos: asRecords(asRecord(snap).chatVistos),
        vistas: asRecords(asRecord(snap).vistas),
      });
    } else if (row.tipo === "proyecto") {
      err = await restaurarProyectoSnap(conn, {
        proyecto: asRecord(asRecord(snap).proyecto),
        miembros: asRecords(asRecord(snap).miembros),
        columnas: asRecords(asRecord(snap).columnas),
        columnasOcultas: asRecords(asRecord(snap).columnasOcultas),
        favoritos: asRecords(asRecord(snap).favoritos),
        asignacionesVistas: asRecords(asRecord(snap).asignacionesVistas),
        notas: asRecords(asRecord(snap).notas),
        sugerencias: asRecords(asRecord(snap).sugerencias),
        tareas: asRecords(asRecord(snap).tareas).map((t) => ({
          tarea: asRecord(t.tarea),
          checklist: asRecords(t.checklist),
          adjuntos: asRecords(t.adjuntos),
          mensajes: asRecords(t.mensajes),
          chatVistos: asRecords(t.chatVistos),
          vistas: asRecords(t.vistas),
        })),
      });
    } else {
      const root = asRecord(snap);
      err = await restaurarClienteSnap(conn, {
        cliente: asRecord(root.cliente),
        notas: asRecords(root.notas),
        proyectos: asRecords(root.proyectos).map((p) => ({
          proyecto: asRecord(p.proyecto),
          miembros: asRecords(p.miembros),
          columnas: asRecords(p.columnas),
          columnasOcultas: asRecords(p.columnasOcultas),
          favoritos: asRecords(p.favoritos),
          asignacionesVistas: asRecords(p.asignacionesVistas),
          notas: asRecords(p.notas),
          sugerencias: asRecords(p.sugerencias),
          tareas: asRecords(p.tareas).map((t) => ({
            tarea: asRecord(t.tarea),
            checklist: asRecords(t.checklist),
            adjuntos: asRecords(t.adjuntos),
            mensajes: asRecords(t.mensajes),
            chatVistos: asRecords(t.chatVistos),
            vistas: asRecords(t.vistas),
          })),
        })),
        conversacionesBorradas: Number(root.conversacionesBorradas ?? 0),
      });
    }

    if (err) {
      await conn.rollback();
      return { ok: false, motivo: err };
    }

    await conn.execute(
      `UPDATE eliminaciones SET restaurado_en = UTC_TIMESTAMP(3) WHERE id = ?`,
      [eliminacionId],
    );
    await conn.commit();
    return {
      ok: true,
      tipo: row.tipo,
      entidadId: row.entidad_id,
      etiqueta: row.etiqueta,
    };
  } catch (e) {
    await conn.rollback();
    const code = (e as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") return { ok: false, motivo: "conflicto" };
    throw e;
  } finally {
    conn.release();
  }
}

export async function purgarEliminacionesExpiradas(): Promise<number> {
  const pool = await getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `DELETE FROM eliminaciones
     WHERE restaurado_en IS NULL AND expira_en <= UTC_TIMESTAMP(3)`,
  );
  return Number(res.affectedRows ?? 0);
}
