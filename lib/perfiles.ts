import { randomUUID } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import { esPermisoValido, type Permiso } from "@/lib/permisos";
import { urlAvatarDe } from "@/lib/usuarios";

export type PerfilLista = {
  id: string;
  nombre: string;
  descripcion: string | null;
  numPermisos: number;
  numUsuarios: number;
};

export type PerfilDetalle = {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: Permiso[];
};

export type UsuarioInternoAsignacion = {
  id: string;
  nombre: string;
  correo: string;
  esAdmin: boolean;
  perfilId: string | null;
  perfilNombre: string | null;
  permisos: Permiso[];
  avatarUrl: string | null;
  ultimoAccesoEn: string | null;
};

type PerfilRow = RowDataPacket & {
  id: string;
  nombre: string;
  descripcion: string | null;
  num_permisos: number;
  num_usuarios: number;
};

type DetalleRow = RowDataPacket & {
  id: string;
  nombre: string;
  descripcion: string | null;
};

type PermisoRow = RowDataPacket & { permiso: string };

type UsuarioRow = RowDataPacket & {
  id: string;
  nombre: string;
  correo: string;
  es_admin: number | boolean;
  perfil_id: string | null;
  perfil_nombre: string | null;
  avatar_gcs: string | null;
  ultimo_acceso_en: Date | string | null;
};

export async function listarPerfiles(): Promise<PerfilLista[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<PerfilRow[]>(
    `SELECT p.id, p.nombre, p.descripcion,
            (SELECT COUNT(*) FROM perfil_permisos pp WHERE pp.perfil_id = p.id) AS num_permisos,
            (SELECT COUNT(*) FROM usuarios u WHERE u.perfil_id = p.id) AS num_usuarios
     FROM perfiles p
     ORDER BY p.nombre ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    numPermisos: Number(r.num_permisos),
    numUsuarios: Number(r.num_usuarios),
  }));
}

export async function obtenerPerfil(id: string): Promise<PerfilDetalle | null> {
  const pool = await getPool();
  const [rows] = await pool.execute<DetalleRow[]>(
    "SELECT id, nombre, descripcion FROM perfiles WHERE id = ? LIMIT 1",
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const [permRows] = await pool.execute<PermisoRow[]>(
    "SELECT permiso FROM perfil_permisos WHERE perfil_id = ?",
    [id],
  );
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    permisos: permRows.map((p) => p.permiso).filter(esPermisoValido),
  };
}

export async function crearPerfil(input: {
  nombre: string;
  descripcion?: string | null;
  permisos: string[];
}): Promise<{ ok: true; id: string } | { ok: false; motivo: "falta_dato" | "duplicado" }> {
  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, motivo: "falta_dato" };
  const permisos = [...new Set(input.permisos.filter(esPermisoValido))];
  const id = randomUUID();
  const pool = await getPool();

  try {
    await pool.execute(
      "INSERT INTO perfiles (id, nombre, descripcion) VALUES (?, ?, ?)",
      [id, nombre, input.descripcion?.trim() || null],
    );
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "ER_DUP_ENTRY") return { ok: false, motivo: "duplicado" };
    throw e;
  }

  for (const permiso of permisos) {
    await pool.execute("INSERT INTO perfil_permisos (perfil_id, permiso) VALUES (?, ?)", [
      id,
      permiso,
    ]);
  }
  return { ok: true, id };
}

export async function actualizarPerfil(input: {
  id: string;
  nombre: string;
  descripcion?: string | null;
  permisos: string[];
}): Promise<{ ok: true } | { ok: false; motivo: "falta_dato" | "duplicado" | "no_encontrado" }> {
  const nombre = input.nombre.trim();
  if (!nombre || !input.id) return { ok: false, motivo: "falta_dato" };
  const permisos = [...new Set(input.permisos.filter(esPermisoValido))];
  const pool = await getPool();

  const [exist] = await pool.execute<DetalleRow[]>(
    "SELECT id FROM perfiles WHERE id = ? LIMIT 1",
    [input.id],
  );
  if (!exist[0]) return { ok: false, motivo: "no_encontrado" };

  try {
    await pool.execute(
      "UPDATE perfiles SET nombre = ?, descripcion = ? WHERE id = ?",
      [nombre, input.descripcion?.trim() || null, input.id],
    );
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "ER_DUP_ENTRY") return { ok: false, motivo: "duplicado" };
    throw e;
  }

  await pool.execute("DELETE FROM perfil_permisos WHERE perfil_id = ?", [input.id]);
  for (const permiso of permisos) {
    await pool.execute("INSERT INTO perfil_permisos (perfil_id, permiso) VALUES (?, ?)", [
      input.id,
      permiso,
    ]);
  }
  return { ok: true };
}

export async function eliminarPerfil(
  id: string,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" | "en_uso" }> {
  const pool = await getPool();
  const [exist] = await pool.execute<DetalleRow[]>(
    "SELECT id FROM perfiles WHERE id = ? LIMIT 1",
    [id],
  );
  if (!exist[0]) return { ok: false, motivo: "no_encontrado" };

  const [uso] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM usuarios WHERE perfil_id = ?",
    [id],
  );
  if (Number((uso[0] as { n: number }).n) > 0) return { ok: false, motivo: "en_uso" };

  const [res] = await pool.execute<ResultSetHeader>("DELETE FROM perfiles WHERE id = ?", [id]);
  if (res.affectedRows === 0) return { ok: false, motivo: "no_encontrado" };
  return { ok: true };
}

export async function listarUsuariosInternos(): Promise<UsuarioInternoAsignacion[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<UsuarioRow[]>(
    `SELECT u.id, u.nombre, u.correo, u.es_admin, u.perfil_id, p.nombre AS perfil_nombre,
            u.avatar_gcs, u.ultimo_acceso_en
     FROM usuarios u
     LEFT JOIN perfiles p ON p.id = u.perfil_id
     WHERE u.rol = 'interna'
     ORDER BY u.nombre ASC`,
  );

  const result: UsuarioInternoAsignacion[] = [];
  for (const r of rows) {
    const [userPermRows] = await pool.execute<PermisoRow[]>(
      "SELECT permiso FROM usuario_permisos WHERE usuario_id = ?",
      [r.id],
    );
    let permisos = userPermRows.map((p) => p.permiso).filter(esPermisoValido);
    if (permisos.length === 0 && r.perfil_id) {
      const [perfilPerms] = await pool.execute<PermisoRow[]>(
        "SELECT permiso FROM perfil_permisos WHERE perfil_id = ?",
        [r.perfil_id],
      );
      permisos = perfilPerms.map((p) => p.permiso).filter(esPermisoValido);
    }
    const acceso =
      r.ultimo_acceso_en instanceof Date
        ? r.ultimo_acceso_en.toISOString()
        : r.ultimo_acceso_en
          ? new Date(r.ultimo_acceso_en).toISOString()
          : null;
    result.push({
      id: r.id,
      nombre: r.nombre,
      correo: r.correo,
      esAdmin: Boolean(r.es_admin),
      perfilId: r.perfil_id,
      perfilNombre: r.perfil_nombre,
      permisos,
      avatarUrl: urlAvatarDe(r.id, r.avatar_gcs),
      ultimoAccesoEn: acceso && !Number.isNaN(Date.parse(acceso)) ? acceso : null,
    });
  }
  return result;
}

async function reemplazarPermisosUsuario(usuarioId: string, permisos: Permiso[]) {
  const pool = await getPool();
  await pool.execute("DELETE FROM usuario_permisos WHERE usuario_id = ?", [usuarioId]);
  for (const permiso of permisos) {
    await pool.execute("INSERT INTO usuario_permisos (usuario_id, permiso) VALUES (?, ?)", [
      usuarioId,
      permiso,
    ]);
  }
}

export async function asignarPerfilUsuario(
  usuarioId: string,
  perfilId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" | "perfil_invalido" }> {
  const pool = await getPool();
  const [users] = await pool.execute<DetalleRow[]>(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'interna' LIMIT 1",
    [usuarioId],
  );
  if (!users[0]) return { ok: false, motivo: "no_encontrado" };

  if (perfilId) {
    const [perfs] = await pool.execute<DetalleRow[]>(
      "SELECT id FROM perfiles WHERE id = ? LIMIT 1",
      [perfilId],
    );
    if (!perfs[0]) return { ok: false, motivo: "perfil_invalido" };
    await pool.execute("UPDATE usuarios SET perfil_id = ? WHERE id = ?", [perfilId, usuarioId]);
    const [permRows] = await pool.execute<PermisoRow[]>(
      "SELECT permiso FROM perfil_permisos WHERE perfil_id = ?",
      [perfilId],
    );
    await reemplazarPermisosUsuario(
      usuarioId,
      permRows.map((p) => p.permiso).filter(esPermisoValido),
    );
  } else {
    await pool.execute("UPDATE usuarios SET perfil_id = NULL WHERE id = ?", [usuarioId]);
    await pool.execute("DELETE FROM usuario_permisos WHERE usuario_id = ?", [usuarioId]);
  }

  return { ok: true };
}

export async function guardarPermisosUsuario(
  usuarioId: string,
  permisos: string[],
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" }> {
  const pool = await getPool();
  const [users] = await pool.execute<DetalleRow[]>(
    "SELECT id FROM usuarios WHERE id = ? AND rol = 'interna' LIMIT 1",
    [usuarioId],
  );
  if (!users[0]) return { ok: false, motivo: "no_encontrado" };

  await reemplazarPermisosUsuario(usuarioId, [...new Set(permisos.filter(esPermisoValido))]);
  return { ok: true };
}
