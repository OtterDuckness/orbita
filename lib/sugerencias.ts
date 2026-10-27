import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { listarProyectos, type Proyecto } from "@/lib/proyectos";
import { crearTarea } from "@/lib/tablero";
import { enviarMensajeTarea } from "@/lib/tarea-chat";

export type EstadoSugerencia = "pendiente" | "convertida";

export type Sugerencia = {
  id: string;
  autorId: string;
  autorNombre: string;
  titulo: string;
  texto: string | null;
  tareaId: string | null;
  proyectoId: string;
  estado: EstadoSugerencia;
  creadoEn: string;
};

function iso(v: Date | string | null | undefined): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) return new Date(v).toISOString();
  return new Date().toISOString();
}

/** Proyecto interno Órbita (tablero de producto). */
export function esProyectoOrbita(proyecto: {
  nombre: string | null;
  ambito: string;
  personalDeId?: string | null;
}): boolean {
  if (proyecto.personalDeId) return false;
  if (proyecto.ambito !== "interno") return false;
  const n = (proyecto.nombre ?? "").trim().toLowerCase();
  return n === "orbita" || n === "órbita";
}

export async function proyectoOrbita(): Promise<Proyecto | null> {
  const proyectos = await listarProyectos(null);
  return proyectos.find((p) => esProyectoOrbita(p)) ?? null;
}

function mapFila(r: {
  id: string;
  autor_id: string;
  autor_nombre: string | null;
  autor_correo: string;
  titulo: string;
  texto: string | null;
  tarea_id: string | null;
  proyecto_id: string;
  estado: string;
  creado_en: Date | string;
}): Sugerencia {
  return {
    id: r.id,
    autorId: r.autor_id,
    autorNombre: r.autor_nombre?.trim() || r.autor_correo,
    titulo: r.titulo,
    texto: r.texto,
    tareaId: r.tarea_id,
    proyectoId: r.proyecto_id,
    estado: r.estado === "convertida" ? "convertida" : "pendiente",
    creadoEn: iso(r.creado_en),
  };
}

export async function crearSugerencia(input: {
  autorId: string;
  autorNombre: string;
  titulo: string;
  texto?: string;
}): Promise<
  | { ok: true; sugerencia: Sugerencia }
  | { ok: false; motivo: "falta_dato" | "no_orbita" }
> {
  const titulo = input.titulo.trim();
  const texto = input.texto?.trim() || null;
  if (!input.autorId.trim()) return { ok: false, motivo: "falta_dato" };
  if (!titulo) return { ok: false, motivo: "falta_dato" };

  const proyecto = await proyectoOrbita();
  if (!proyecto) return { ok: false, motivo: "no_orbita" };

  const id = randomUUID();
  const creadoEn = new Date();
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO sugerencias
       (id, autor_id, titulo, texto, tarea_id, proyecto_id, estado, creado_en)
     VALUES (?, ?, ?, ?, NULL, ?, 'pendiente', ?)`,
    [id, input.autorId, titulo, texto, proyecto.id, creadoEn],
  );

  return {
    ok: true,
    sugerencia: {
      id,
      autorId: input.autorId,
      autorNombre: input.autorNombre,
      titulo,
      texto,
      tareaId: null,
      proyectoId: proyecto.id,
      estado: "pendiente",
      creadoEn: creadoEn.toISOString(),
    },
  };
}

export async function listarSugerenciasPendientes(): Promise<Sugerencia[]> {
  try {
    const pool = await getPool();
    const [rows] = await pool.execute<
      (RowDataPacket & {
        id: string;
        autor_id: string;
        autor_nombre: string | null;
        autor_correo: string;
        titulo: string;
        texto: string | null;
        tarea_id: string | null;
        proyecto_id: string;
        estado: string;
        creado_en: Date | string;
      })[]
    >(
      `SELECT s.id, s.autor_id, u.nombre AS autor_nombre, u.correo AS autor_correo,
              s.titulo, s.texto, s.tarea_id, s.proyecto_id, s.estado, s.creado_en
       FROM sugerencias s
       JOIN usuarios u ON u.id = s.autor_id
       WHERE s.estado = 'pendiente'
       ORDER BY s.creado_en DESC
       LIMIT 100`,
    );
    return rows.map(mapFila);
  } catch (error) {
    console.error("[sugerencias] listar pendientes falló (¿falta migración 024?)", {
      error,
    });
    return [];
  }
}

export async function convertirSugerenciaEnTarea(input: {
  sugerenciaId: string;
  responsableId: string;
  notasTecnicas?: string;
  mandadaPorId: string;
}): Promise<
  | { ok: true; sugerencia: Sugerencia }
  | {
      ok: false;
      motivo:
        | "falta_dato"
        | "no_encontrado"
        | "no_pendiente"
        | "no_orbita"
        | "ya_convertida";
    }
> {
  const id = input.sugerenciaId.trim();
  const responsableId = input.responsableId.trim();
  const mandadaPorId = input.mandadaPorId.trim();
  const notasTecnicas = input.notasTecnicas?.trim() || null;
  if (!id || !responsableId || !mandadaPorId) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [rows] = await pool.execute<
    (RowDataPacket & {
      id: string;
      autor_id: string;
      autor_nombre: string | null;
      autor_correo: string;
      titulo: string;
      texto: string | null;
      tarea_id: string | null;
      proyecto_id: string;
      estado: string;
      creado_en: Date | string;
    })[]
  >(
    `SELECT s.id, s.autor_id, u.nombre AS autor_nombre, u.correo AS autor_correo,
            s.titulo, s.texto, s.tarea_id, s.proyecto_id, s.estado, s.creado_en
     FROM sugerencias s
     JOIN usuarios u ON u.id = s.autor_id
     WHERE s.id = ?
     LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return { ok: false, motivo: "no_encontrado" };
  if (row.estado !== "pendiente" || row.tarea_id) {
    return { ok: false, motivo: "ya_convertida" };
  }

  const proyecto = await proyectoOrbita();
  if (!proyecto) return { ok: false, motivo: "no_orbita" };

  const poolCols = new Set(
    proyecto.colaboradorIds.length ? proyecto.colaboradorIds : [responsableId],
  );
  poolCols.add(responsableId);
  poolCols.add(row.autor_id);
  const colaboradorIds = [...poolCols];

  const tareaR = await crearTarea({
    proyectoId: proyecto.id,
    nombre: row.titulo,
    responsableIds: [responsableId],
    colaboradorIds,
    mandadaPorId,
    prioridad: "media",
  });
  if (!tareaR.ok) return { ok: false, motivo: tareaR.motivo };

  if (notasTecnicas) {
    await pool.execute(
      `UPDATE tareas
       SET notas = ?, notas_autor_id = ?, notas_creado_en = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [notasTecnicas, mandadaPorId, tareaR.tarea.id],
    );
  }

  if (row.texto?.trim()) {
    await enviarMensajeTarea(tareaR.tarea.id, row.autor_id, row.texto);
  }

  await pool.execute(
    `UPDATE sugerencias
     SET tarea_id = ?, proyecto_id = ?, estado = 'convertida'
     WHERE id = ? AND estado = 'pendiente'`,
    [tareaR.tarea.id, proyecto.id, id],
  );

  return {
    ok: true,
    sugerencia: {
      ...mapFila(row),
      tareaId: tareaR.tarea.id,
      proyectoId: proyecto.id,
      estado: "convertida",
    },
  };
}

export async function borrarSugerencia(
  sugerenciaId: string,
): Promise<{ ok: true } | { ok: false; motivo: "falta_dato" | "no_encontrado" | "no_pendiente" }> {
  const id = sugerenciaId.trim();
  if (!id) return { ok: false, motivo: "falta_dato" };

  const pool = await getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM sugerencias
     WHERE id = ? AND estado = 'pendiente' AND tarea_id IS NULL`,
    [id],
  );
  if (result.affectedRows === 0) return { ok: false, motivo: "no_encontrado" };
  return { ok: true };
}
