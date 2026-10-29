import { randomUUID } from "crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import {
  AVATAR_MAX_BYTES,
  borrarObjeto,
  mimeImagenPermitido,
  objectPathAvatar,
  subirObjeto,
} from "@/lib/gcs";
import {
  PERMISOS,
  esPermisoValido,
  puedeConPermisos,
  type Permiso,
} from "@/lib/permisos";

export type Usuario = {
  id: string;
  nombre: string;
  correo: string;
};

/** Forma usada en selects/UI (mismo shape que PersonaEquipo del mock). */
export type MiembroEquipo = {
  id: string;
  nombre: string;
  email: string;
  avatarUrl: string | null;
};

export type UsuarioAuth = {
  id: string;
  nombre: string;
  correo: string;
  rol: string | null;
  esAdmin: boolean;
  /** Admin real en BD (ignora cookie vista usuario). Para switches de simulación. */
  esAdminReal: boolean;
  perfilId: string | null;
  permisos: Permiso[];
  avatarUrl: string | null;
  /** IANA, p. ej. Europe/Madrid. */
  timezone: string;
};

/** URL de la API de avatar si hay objeto en GCS. */
export function urlAvatarDe(usuarioId: string, avatarGcs: string | null | undefined): string | null {
  return avatarGcs?.trim() ? `/api/avatars/${usuarioId}` : null;
}

export type GoogleTokens = {
  refreshToken?: string | null;
  accessToken?: string | null;
  expiry?: Date | null;
};

type UsuarioRow = RowDataPacket & {
  id: string;
  nombre: string;
  correo: string;
  avatar_gcs: string | null;
};

type AuthRow = RowDataPacket & {
  id: string;
  nombre: string;
  correo: string;
  rol: string | null;
  es_admin: number | boolean;
  perfil_id: string | null;
  avatar_gcs?: string | null;
  timezone?: string | null;
};

type PermisoRow = RowDataPacket & { permiso: string };

type TokenRow = RowDataPacket & {
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expiry: Date | string | null;
};

/** Equipo interno para selects (todos los usuarios de BD). */
export async function listarEquipo(): Promise<MiembroEquipo[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<UsuarioRow[]>(
    "SELECT id, nombre, correo, avatar_gcs FROM usuarios ORDER BY nombre ASC",
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    email: r.correo,
    avatarUrl: urlAvatarDe(r.id, r.avatar_gcs),
  }));
}

export async function mapaEquipo(): Promise<Map<string, MiembroEquipo>> {
  const equipo = await listarEquipo();
  return new Map(equipo.map((p) => [p.id, p]));
}

export async function usuarioPorId(id: string | null | undefined): Promise<MiembroEquipo | null> {
  if (!id) return null;
  const pool = await getPool();
  const [rows] = await pool.execute<UsuarioRow[]>(
    "SELECT id, nombre, correo, avatar_gcs FROM usuarios WHERE id = ? LIMIT 1",
    [id],
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        email: r.correo,
        avatarUrl: urlAvatarDe(r.id, r.avatar_gcs),
      }
    : null;
}

export async function usuarioPorCorreo(correo: string | null | undefined): Promise<MiembroEquipo | null> {
  if (!correo) return null;
  const email = correo.trim().toLowerCase();
  const pool = await getPool();
  const [rows] = await pool.execute<UsuarioRow[]>(
    "SELECT id, nombre, correo, avatar_gcs FROM usuarios WHERE correo = ? LIMIT 1",
    [email],
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        email: r.correo,
        avatarUrl: urlAvatarDe(r.id, r.avatar_gcs),
      }
    : null;
}

/** Crea el usuario si no existe. Si existe, no toca el nombre (se personaliza en Ajustes). */
export async function asegurarUsuario(input: {
  nombre?: string | null;
  correo: string;
}): Promise<Usuario> {
  const correo = input.correo.trim().toLowerCase();
  const nombre = input.nombre?.trim() || correo;
  const pool = await getPool();

  const [rows] = await pool.execute<UsuarioRow[]>(
    "SELECT id, nombre, correo, avatar_gcs FROM usuarios WHERE correo = ? LIMIT 1",
    [correo],
  );

  const row = rows[0];
  if (row) {
    return { id: row.id, nombre: row.nombre, correo: row.correo };
  }

  const id = randomUUID();
  await pool.execute(
    "INSERT INTO usuarios (id, nombre, correo, rol) VALUES (?, ?, ?, 'interna')",
    [id, nombre, correo],
  );

  return { id, nombre, correo };
}

/** Actualiza ultimo_acceso_en (login). Ignora si la columna aún no existe en BD vieja. */
export async function registrarAccesoUsuario(usuarioId: string): Promise<void> {
  if (!usuarioId) return;
  try {
    const pool = await getPool();
    await pool.execute(
      "UPDATE usuarios SET ultimo_acceso_en = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [usuarioId],
    );
  } catch (error) {
    console.warn("[usuarios] no se pudo registrar ultimo_acceso_en", { usuarioId, error });
  }
}

export async function obtenerUsuarioAuthPorCorreo(
  correo: string,
  opts?: { ignorarVistaUsuario?: boolean },
): Promise<UsuarioAuth | null> {
  const email = correo.trim().toLowerCase();
  const pool = await getPool();
  let row: AuthRow | undefined;
  const [rows] = await pool.execute<AuthRow[]>(
    `SELECT id, nombre, correo, rol, es_admin, perfil_id, avatar_gcs, timezone
     FROM usuarios WHERE correo = ? LIMIT 1`,
    [email],
  );
  row = rows[0];
  if (!row) return null;

  const esAdminDb = Boolean(row.es_admin);
  let esAdmin = esAdminDb;
  if (esAdminDb && !opts?.ignorarVistaUsuario) {
    const { cookieVistaUsuarioActiva } = await import("@/lib/vista-usuario");
    if (await cookieVistaUsuarioActiva()) esAdmin = false;
  }
  let permisos: Permiso[] = [];

  if (esAdmin) {
    permisos = [...PERMISOS];
  } else {
    const [userPermRows] = await pool.execute<PermisoRow[]>(
      "SELECT permiso FROM usuario_permisos WHERE usuario_id = ?",
      [row.id],
    );
    if (userPermRows.length > 0) {
      permisos = userPermRows.map((p) => p.permiso).filter(esPermisoValido);
    } else if (row.perfil_id) {
      const [permRows] = await pool.execute<PermisoRow[]>(
        "SELECT permiso FROM perfil_permisos WHERE perfil_id = ?",
        [row.perfil_id],
      );
      permisos = permRows.map((p) => p.permiso).filter(esPermisoValido);
    }
  }

  const { parseZona } = await import("@/lib/zona");
  const { aplicarZona } = await import("@/lib/zona-server");
  const timezone = parseZona(row.timezone);
  aplicarZona(timezone);

  return {
    id: row.id,
    nombre: row.nombre,
    correo: row.correo,
    rol: row.rol,
    esAdmin,
    esAdminReal: esAdminDb,
    perfilId: row.perfil_id,
    permisos,
    avatarUrl: urlAvatarDe(row.id, row.avatar_gcs),
    timezone,
  };
}

export async function guardarTimezoneUsuario(
  usuarioId: string,
  timezone: string,
): Promise<{ ok: true; timezone: string } | { ok: false; motivo: "zona_invalida" }> {
  const { esZonaValida, parseZona } = await import("@/lib/zona");
  if (!esZonaValida(timezone)) return { ok: false, motivo: "zona_invalida" };
  const zona = parseZona(timezone);
  const pool = await getPool();
  await pool.execute("UPDATE usuarios SET timezone = ? WHERE id = ?", [zona, usuarioId]);
  return { ok: true, timezone: zona };
}

export function usuarioPuede(usuario: UsuarioAuth, permiso: Permiso): boolean {
  return puedeConPermisos(usuario.permisos, usuario.esAdmin, permiso);
}

export async function guardarTokensGoogle(correo: string, tokens: GoogleTokens): Promise<void> {
  const email = correo.trim().toLowerCase();
  const pool = await getPool();

  const sets: string[] = [];
  const params: (string | Date | null)[] = [];

  if (tokens.refreshToken) {
    sets.push("google_refresh_token = ?");
    params.push(tokens.refreshToken);
  }
  if (tokens.accessToken !== undefined) {
    sets.push("google_access_token = ?");
    params.push(tokens.accessToken);
  }
  if (tokens.expiry !== undefined) {
    sets.push("google_token_expiry = ?");
    params.push(tokens.expiry);
  }

  if (sets.length === 0) return;

  params.push(email);
  await pool.execute(`UPDATE usuarios SET ${sets.join(", ")} WHERE correo = ?`, params);
}

export async function tokensGooglePorCorreo(correo: string): Promise<GoogleTokens | null> {
  const email = correo.trim().toLowerCase();
  const pool = await getPool();
  const [rows] = await pool.execute<TokenRow[]>(
    `SELECT google_refresh_token, google_access_token, google_token_expiry
     FROM usuarios WHERE correo = ? LIMIT 1`,
    [email],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    refreshToken: row.google_refresh_token,
    accessToken: row.google_access_token,
    expiry: row.google_token_expiry ? new Date(row.google_token_expiry) : null,
  };
}

function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

async function contarAdminsInternos(excluirId?: string): Promise<number> {
  const pool = await getPool();
  if (excluirId) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM usuarios
       WHERE rol = 'interna' AND es_admin = 1 AND id <> ?`,
      [excluirId],
    );
    return Number((rows[0] as { n: number }).n);
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'interna' AND es_admin = 1`,
  );
  return Number((rows[0] as { n: number }).n);
}

/** Alta manual de usuario interno (basta para poder iniciar sesión con Google). */
export async function crearUsuarioInterno(input: {
  nombre: string;
  correo: string;
  perfilId?: string | null;
  esAdmin?: boolean;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; motivo: "falta_dato" | "correo_invalido" | "correo_duplicado" | "perfil_invalido" }
> {
  const nombre = input.nombre.trim();
  const correo = input.correo.trim().toLowerCase();
  if (!nombre || !correo) return { ok: false, motivo: "falta_dato" };
  if (!correoValido(correo)) return { ok: false, motivo: "correo_invalido" };

  const perfilId = input.perfilId?.trim() || null;
  const esAdmin = Boolean(input.esAdmin);
  const id = randomUUID();
  const pool = await getPool();

  if (perfilId) {
    const [perfs] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM perfiles WHERE id = ? LIMIT 1",
      [perfilId],
    );
    if (!perfs[0]) return { ok: false, motivo: "perfil_invalido" };
  }

  try {
    await pool.execute(
      `INSERT INTO usuarios (id, nombre, correo, rol, es_admin, perfil_id)
       VALUES (?, ?, ?, 'interna', ?, ?)`,
      [id, nombre, correo, esAdmin ? 1 : 0, perfilId],
    );
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "ER_DUP_ENTRY") return { ok: false, motivo: "correo_duplicado" };
    throw e;
  }

  if (perfilId) {
    const [permRows] = await pool.execute<PermisoRow[]>(
      "SELECT permiso FROM perfil_permisos WHERE perfil_id = ?",
      [perfilId],
    );
    for (const p of permRows) {
      if (!esPermisoValido(p.permiso)) continue;
      await pool.execute("INSERT INTO usuario_permisos (usuario_id, permiso) VALUES (?, ?)", [
        id,
        p.permiso,
      ]);
    }
  }

  return { ok: true, id };
}

export async function actualizarAdminUsuario(
  usuarioId: string,
  esAdmin: boolean,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" | "ultimo_admin" }> {
  if (!usuarioId) return { ok: false, motivo: "no_encontrado" };
  const pool = await getPool();
  const [rows] = await pool.execute<AuthRow[]>(
    `SELECT id, nombre, correo, rol, es_admin, perfil_id
     FROM usuarios WHERE id = ? AND rol = 'interna' LIMIT 1`,
    [usuarioId],
  );
  const row = rows[0];
  if (!row) return { ok: false, motivo: "no_encontrado" };

  const eraAdmin = Boolean(row.es_admin);
  if (eraAdmin && !esAdmin) {
    const resto = await contarAdminsInternos(usuarioId);
    if (resto < 1) return { ok: false, motivo: "ultimo_admin" };
  }

  await pool.execute("UPDATE usuarios SET es_admin = ? WHERE id = ?", [
    esAdmin ? 1 : 0,
    usuarioId,
  ]);
  return { ok: true };
}

export async function eliminarUsuarioInterno(
  usuarioId: string,
  actorId: string,
): Promise<
  | { ok: true }
  | { ok: false; motivo: "no_encontrado" | "no_auto_eliminar" | "ultimo_admin" | "usuario_en_uso" }
> {
  if (!usuarioId) return { ok: false, motivo: "no_encontrado" };
  if (usuarioId === actorId) return { ok: false, motivo: "no_auto_eliminar" };

  const pool = await getPool();
  const [rows] = await pool.execute<AuthRow[]>(
    `SELECT id, nombre, correo, rol, es_admin, perfil_id
     FROM usuarios WHERE id = ? AND rol = 'interna' LIMIT 1`,
    [usuarioId],
  );
  const row = rows[0];
  if (!row) return { ok: false, motivo: "no_encontrado" };

  if (Boolean(row.es_admin)) {
    const resto = await contarAdminsInternos(usuarioId);
    if (resto < 1) return { ok: false, motivo: "ultimo_admin" };
  }

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      "DELETE FROM usuarios WHERE id = ? AND rol = 'interna'",
      [usuarioId],
    );
    if (res.affectedRows === 0) {
      return { ok: false, motivo: "no_encontrado" };
    }
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number };
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.errno === 1451) {
      return { ok: false, motivo: "usuario_en_uso" };
    }
    throw e;
  }

  return { ok: true };
}

export async function actualizarNombreUsuario(
  usuarioId: string,
  nombreRaw: string,
): Promise<{ ok: true; nombre: string } | { ok: false; motivo: "falta_dato" | "no_encontrado" }> {
  const nombre = nombreRaw.trim();
  if (!nombre || !usuarioId) return { ok: false, motivo: "falta_dato" };
  const pool = await getPool();
  const [res] = await pool.execute<ResultSetHeader>(
    "UPDATE usuarios SET nombre = ? WHERE id = ?",
    [nombre.slice(0, 255), usuarioId],
  );
  if (res.affectedRows === 0) return { ok: false, motivo: "no_encontrado" };
  return { ok: true, nombre: nombre.slice(0, 255) };
}

export async function guardarAvatarUsuario(
  usuarioId: string,
  archivo: { buffer: Buffer; nombre: string; mime: string; tamanoBytes: number },
): Promise<
  | { ok: true; avatarUrl: string }
  | {
      ok: false;
      motivo: "falta_dato" | "no_encontrado" | "archivo_invalido" | "archivo_grande" | "gcs_error";
    }
> {
  if (!usuarioId) return { ok: false, motivo: "falta_dato" };
  if (archivo.tamanoBytes <= 0 || archivo.tamanoBytes > AVATAR_MAX_BYTES) {
    return { ok: false, motivo: "archivo_grande" };
  }
  if (!mimeImagenPermitido(archivo.mime)) return { ok: false, motivo: "archivo_invalido" };

  const pool = await getPool();
  const [rows] = await pool.execute<(RowDataPacket & { id: string; avatar_gcs: string | null })[]>(
    "SELECT id, avatar_gcs FROM usuarios WHERE id = ? LIMIT 1",
    [usuarioId],
  );
  const row = rows[0];
  if (!row) return { ok: false, motivo: "no_encontrado" };

  const path = await objectPathAvatar(usuarioId, archivo.nombre);
  try {
    await subirObjeto({ objectPath: path, buffer: archivo.buffer, mime: archivo.mime });
  } catch (err) {
    console.error("[gcs] avatar upload falló", { usuarioId, error: err });
    return { ok: false, motivo: "gcs_error" };
  }

  await pool.execute("UPDATE usuarios SET avatar_gcs = ? WHERE id = ?", [path, usuarioId]);
  if (row.avatar_gcs && row.avatar_gcs !== path) {
    await borrarObjeto(row.avatar_gcs).catch(() => undefined);
  }
  return { ok: true, avatarUrl: urlAvatarDe(usuarioId, path)! };
}

export async function quitarAvatarUsuario(
  usuarioId: string,
): Promise<{ ok: true } | { ok: false; motivo: "no_encontrado" }> {
  if (!usuarioId) return { ok: false, motivo: "no_encontrado" };
  const pool = await getPool();
  const [rows] = await pool.execute<(RowDataPacket & { id: string; avatar_gcs: string | null })[]>(
    "SELECT id, avatar_gcs FROM usuarios WHERE id = ? LIMIT 1",
    [usuarioId],
  );
  const row = rows[0];
  if (!row) return { ok: false, motivo: "no_encontrado" };

  await pool.execute("UPDATE usuarios SET avatar_gcs = NULL WHERE id = ?", [usuarioId]);
  if (row.avatar_gcs) {
    await borrarObjeto(row.avatar_gcs).catch(() => undefined);
  }
  return { ok: true };
}

export async function avatarParaServir(
  usuarioId: string,
): Promise<{ ok: true; gcsObject: string } | { ok: false; motivo: "no_encontrado" }> {
  if (!usuarioId) return { ok: false, motivo: "no_encontrado" };
  const pool = await getPool();
  const [rows] = await pool.execute<(RowDataPacket & { avatar_gcs: string | null })[]>(
    "SELECT avatar_gcs FROM usuarios WHERE id = ? LIMIT 1",
    [usuarioId],
  );
  const gcs = rows[0]?.avatar_gcs?.trim();
  if (!gcs) return { ok: false, motivo: "no_encontrado" };
  return { ok: true, gcsObject: gcs };
}
