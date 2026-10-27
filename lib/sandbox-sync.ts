import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import { getPoolProd, getPoolPruebas } from "@/lib/db";

type IdRow = RowDataPacket & { id: string };

/**
 * Copia catálogo y usuarios internas de prod → pruebas (sin clientes reales ni tokens Google).
 */
export async function sincronizarUsuariosAPruebas(): Promise<{ ok: true } | { ok: false; error: string }> {
  const prod = getPoolProd();
  const pruebas = getPoolPruebas();

  try {
    await copiarFilas(
      prod,
      pruebas,
      "SELECT codigo, nombre, creado_en, actualizado_en FROM roles",
      `INSERT INTO roles (codigo, nombre, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), actualizado_en = VALUES(actualizado_en)`,
      (r) => [r.codigo, r.nombre, r.creado_en, r.actualizado_en],
    );

    await copiarFilas(
      prod,
      pruebas,
      "SELECT id, nombre, descripcion, creado_en, actualizado_en FROM perfiles",
      `INSERT INTO perfiles (id, nombre, descripcion, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion),
         actualizado_en = VALUES(actualizado_en)`,
      (r) => [r.id, r.nombre, r.descripcion, r.creado_en, r.actualizado_en],
    );

    const [perfilPerms] = await prod.execute<RowDataPacket[]>(
      "SELECT perfil_id, permiso FROM perfil_permisos",
    );
    for (const r of perfilPerms) {
      await pruebas.execute(
        `INSERT INTO perfil_permisos (perfil_id, permiso) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE permiso = VALUES(permiso)`,
        [r.perfil_id, r.permiso],
      );
    }

    await copiarFilas(
      prod,
      pruebas,
      "SELECT id, nombre, orden, activo, creado_en, actualizado_en FROM tipos_proyecto",
      `INSERT INTO tipos_proyecto (id, nombre, orden, activo, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), orden = VALUES(orden),
         activo = VALUES(activo), actualizado_en = VALUES(actualizado_en)`,
      (r) => [r.id, r.nombre, r.orden, r.activo, r.creado_en, r.actualizado_en],
    );

    const [internasProd] = await prod.execute<
      (RowDataPacket & {
        id: string;
        nombre: string;
        correo: string;
        rol: string | null;
        es_admin: number | boolean;
        perfil_id: string | null;
        holded_employee_id: string | null;
        avatar_gcs: string | null;
      })[]
    >(
      `SELECT id, nombre, correo, rol, es_admin, perfil_id, holded_employee_id, avatar_gcs
       FROM usuarios WHERE rol = 'interna'`,
    );

    for (const u of internasProd) {
      const [choque] = await pruebas.execute<IdRow[]>(
        "SELECT id FROM usuarios WHERE correo = ? AND id <> ? LIMIT 1",
        [u.correo, u.id],
      );
      const viejo = choque[0]?.id;
      if (!viejo) continue;
      await pruebas.execute("DELETE FROM usuario_permisos WHERE usuario_id = ?", [viejo]);
      await pruebas.execute("DELETE FROM usuarios WHERE id = ?", [viejo]);
    }

    for (const r of internasProd) {
      await pruebas.execute(
        `INSERT INTO usuarios (id, nombre, correo, rol, es_admin, cliente_id, perfil_id, holded_employee_id, avatar_gcs)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), correo = VALUES(correo),
           rol = VALUES(rol), es_admin = VALUES(es_admin), perfil_id = VALUES(perfil_id),
           holded_employee_id = VALUES(holded_employee_id),
           avatar_gcs = VALUES(avatar_gcs), actualizado_en = CURRENT_TIMESTAMP(3)`,
        [
          r.id,
          r.nombre,
          r.correo,
          r.rol,
          r.es_admin,
          r.perfil_id,
          r.holded_employee_id,
          r.avatar_gcs,
        ],
      );
    }

    const [internas] = await prod.execute<IdRow[]>(
      "SELECT id FROM usuarios WHERE rol = 'interna'",
    );
    if (internas.length > 0) {
      const ids = internas.map((r) => r.id);
      const ph = ids.map(() => "?").join(",");
      const [perms] = await prod.execute<RowDataPacket[]>(
        `SELECT usuario_id, permiso FROM usuario_permisos WHERE usuario_id IN (${ph})`,
        ids,
      );
      for (const r of perms) {
        await pruebas.execute(
          `INSERT INTO usuario_permisos (usuario_id, permiso) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE permiso = VALUES(permiso)`,
          [r.usuario_id, r.permiso],
        );
      }
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar sandbox";
    console.error("[sandbox] sync usuarios", e);
    return { ok: false, error: msg };
  }
}

type ParametroSql = string | number | boolean | Date | null;

async function copiarFilas(
  prod: Pool,
  pruebas: Pool,
  selectSql: string,
  upsertSql: string,
  paramsDe: (r: RowDataPacket) => ParametroSql[],
): Promise<void> {
  const [rows] = await prod.execute<RowDataPacket[]>(selectSql);
  for (const r of rows) {
    await pruebas.execute(upsertSql, paramsDe(r));
  }
}
