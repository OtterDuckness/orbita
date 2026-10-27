import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import type { UsuarioAuth } from "@/lib/usuarios";
import { usuarioPuede } from "@/lib/usuarios";

export type MiembroHolded = {
  id: string;
  nombre: string;
  correo: string;
  holdedEmployeeId: string | null;
};

type MapRow = RowDataPacket & {
  id: string;
  nombre: string;
  correo: string;
  holded_employee_id: string | null;
};

export async function obtenerHoldedEmployeeId(usuarioId: string): Promise<string | null> {
  try {
    const pool = await getPool();
    const [rows] = await pool.execute<MapRow[]>(
      "SELECT holded_employee_id FROM usuarios WHERE id = ? LIMIT 1",
      [usuarioId],
    );
    const v = rows[0]?.holded_employee_id?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export async function guardarHoldedEmployeeId(
  usuarioId: string,
  holdedEmployeeId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" }> {
  const pool = await getPool();
  const id = holdedEmployeeId?.trim() || null;
  try {
    const [res] = await pool.execute<ResultSetHeader>(
      "UPDATE usuarios SET holded_employee_id = ? WHERE id = ? AND rol = 'interna'",
      [id, usuarioId],
    );
    if (res.affectedRows === 0) return { ok: false, motivo: "no_encontrado" };
    return { ok: true };
  } catch {
    return { ok: false, motivo: "no_encontrado" };
  }
}

export async function listarEquipoDeJefe(jefeUsuarioId: string): Promise<MiembroHolded[]> {
  try {
    const pool = await getPool();
    const [rows] = await pool.execute<MapRow[]>(
      `SELECT u.id, u.nombre, u.correo, u.holded_employee_id
       FROM usuario_holded_equipo e
       INNER JOIN usuarios u ON u.id = e.trabajador_usuario_id
       WHERE e.jefe_usuario_id = ?
       ORDER BY u.nombre ASC`,
      [jefeUsuarioId],
    );
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      correo: r.correo,
      holdedEmployeeId: r.holded_employee_id?.trim() || null,
    }));
  } catch {
    return [];
  }
}

export async function listarInternosConHolded(): Promise<MiembroHolded[]> {
  const pool = await getPool();
  try {
    const [rows] = await pool.execute<MapRow[]>(
      `SELECT id, nombre, correo, holded_employee_id
       FROM usuarios
       WHERE rol = 'interna'
       ORDER BY nombre ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      correo: r.correo,
      holdedEmployeeId: r.holded_employee_id?.trim() || null,
    }));
  } catch {
    const [rows] = await pool.execute<MapRow[]>(
      `SELECT id, nombre, correo, NULL AS holded_employee_id
       FROM usuarios
       WHERE rol = 'interna'
       ORDER BY nombre ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      correo: r.correo,
      holdedEmployeeId: null,
    }));
  }
}

export async function reemplazarEquipoJefe(
  jefeUsuarioId: string,
  trabajadorIds: string[],
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" }> {
  const pool = await getPool();
  const [jefe] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'interna' LIMIT 1",
    [jefeUsuarioId],
  );
  if (!jefe[0]) return { ok: false, motivo: "no_encontrado" };

  try {
    await pool.execute("DELETE FROM usuario_holded_equipo WHERE jefe_usuario_id = ?", [
      jefeUsuarioId,
    ]);
    const unicos = [...new Set(trabajadorIds.filter((id) => id && id !== jefeUsuarioId))];
    for (const tid of unicos) {
      await pool.execute(
        `INSERT INTO usuario_holded_equipo (jefe_usuario_id, trabajador_usuario_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE creado_en = creado_en`,
        [jefeUsuarioId, tid],
      );
    }
    return { ok: true };
  } catch {
    return { ok: false, motivo: "no_encontrado" };
  }
}

/** ¿Puede el actor operar sobre el holdedEmployeeId / usuario objetivo? */
export function puedeAccederEmpleadoHolded(
  actor: UsuarioAuth,
  objetivo: { id: string; holdedEmployeeId: string | null },
  equipoIds: Set<string>,
): boolean {
  if (usuarioPuede(actor, "mi_zona.admin") || actor.esAdmin) return true;
  if (objetivo.id === actor.id) return true;
  if (usuarioPuede(actor, "mi_zona.equipo") && equipoIds.has(objetivo.id)) return true;
  return false;
}

export async function idsEquipoAccesibles(actor: UsuarioAuth): Promise<Set<string>> {
  if (usuarioPuede(actor, "mi_zona.admin") || actor.esAdmin) {
    const todos = await listarInternosConHolded();
    return new Set(todos.map((t) => t.id));
  }
  if (usuarioPuede(actor, "mi_zona.equipo")) {
    const equipo = await listarEquipoDeJefe(actor.id);
    return new Set(equipo.map((t) => t.id));
  }
  return new Set([actor.id]);
}
