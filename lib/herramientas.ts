import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type Herramienta = {
  id: string;
  usuarioId: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  url: string;
  orden: number;
};

export type HerramientaInput = {
  nombre: string;
  categoria: string;
  descripcion: string;
  url: string;
};

/** Defaults al primer acceso (URLs oficiales genéricas; editables en UI). */
export const HERRAMIENTAS_DEFAULT: HerramientaInput[] = [
  {
    nombre: "Holded",
    categoria: "ERP, facturación y RRHH",
    descripcion:
      "Trae facturas, clientes, cobros y el control horario. Holded sigue siendo el registro oficial; Órbita lo lee.",
    url: "https://app.holded.com",
  },
  {
    nombre: "Clientify",
    categoria: "CRM",
    descripcion:
      "Trae oportunidades y estado del embudo comercial para la sección de Comercial.",
    url: "https://app.clientify.com",
  },
  {
    nombre: "Google Workspace",
    categoria: "Productividad",
    descripcion:
      "Crea la carpeta de Drive del cliente, da acceso con su correo y envía la bienvenida.",
    url: "https://workspace.google.com",
  },
  {
    nombre: "Modular DS",
    categoria: "Webs",
    descripcion:
      "No tiene API pública. Entra como acceso directo desde Órbita; el mantenimiento de webs se sigue gestionando allí.",
    url: "https://modular.software",
  },
  {
    nombre: "Canva",
    categoria: "Creatividad",
    descripcion: "Acceso directo a las carpetas de marca. Las piezas siguen viviendo en Canva.",
    url: "https://www.canva.com",
  },
  {
    nombre: "SEO Conjuntas",
    categoria: "SEO",
    descripcion: "Acceso directo a las herramientas de SEO que ya usáis.",
    url: "https://seoconjuntas.com",
  },
];

type HerramientaRow = RowDataPacket & {
  id: string;
  usuario_id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  url: string;
  orden: number;
};

function mapRow(r: HerramientaRow): Herramienta {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    nombre: r.nombre,
    categoria: r.categoria,
    descripcion: r.descripcion,
    url: r.url,
    orden: r.orden,
  };
}

export function normalizarUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function validarHerramientaInput(
  raw: Partial<HerramientaInput>,
):
  | { ok: true; data: HerramientaInput }
  | { ok: false; motivo: "falta_dato" | "url_invalida" } {
  const nombre = String(raw.nombre ?? "").trim();
  const categoria = String(raw.categoria ?? "").trim().slice(0, 80);
  const descripcion = String(raw.descripcion ?? "").trim().slice(0, 500);
  const urlNorm = normalizarUrl(String(raw.url ?? ""));
  if (!nombre || nombre.length > 120) return { ok: false, motivo: "falta_dato" };
  if (!urlNorm) return { ok: false, motivo: "url_invalida" };
  return {
    ok: true,
    data: { nombre, categoria, descripcion, url: urlNorm },
  };
}

async function contarDe(usuarioId: string): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM herramientas_usuario WHERE usuario_id = ?",
    [usuarioId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function seedDefaults(usuarioId: string): Promise<void> {
  const pool = await getPool();
  let orden = 0;
  for (const d of HERRAMIENTAS_DEFAULT) {
    await pool.execute(
      `INSERT INTO herramientas_usuario
        (id, usuario_id, nombre, categoria, descripcion, url, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), usuarioId, d.nombre, d.categoria, d.descripcion, d.url, orden++],
    );
  }
}

/** Lista del usuario; si está vacío, inserta los 6 defaults. */
export async function listarHerramientasDe(usuarioId: string): Promise<Herramienta[]> {
  const uid = usuarioId.trim();
  if (!uid) return [];

  try {
    if ((await contarDe(uid)) === 0) {
      await seedDefaults(uid);
    }
    const pool = await getPool();
    const [rows] = await pool.execute<HerramientaRow[]>(
      `SELECT id, usuario_id, nombre, categoria, descripcion, url, orden
         FROM herramientas_usuario
        WHERE usuario_id = ?
        ORDER BY orden ASC, creado_en ASC`,
      [uid],
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error("[herramientas] listarHerramientasDe falló (¿falta migración 037?)", {
      usuarioId: uid,
      error,
    });
    return [];
  }
}

export async function crearHerramienta(
  usuarioId: string,
  input: HerramientaInput,
): Promise<{ ok: true; id: string } | { ok: false; motivo: "falta_dato" | "bd" }> {
  const uid = usuarioId.trim();
  const v = validarHerramientaInput(input);
  if (!uid || !v.ok) return { ok: false, motivo: "falta_dato" };

  try {
    const pool = await getPool();
    const [maxRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COALESCE(MAX(orden), -1) AS m FROM herramientas_usuario WHERE usuario_id = ?",
      [uid],
    );
    const orden = Number(maxRows[0]?.m ?? -1) + 1;
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO herramientas_usuario
        (id, usuario_id, nombre, categoria, descripcion, url, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, uid, v.data.nombre, v.data.categoria, v.data.descripcion, v.data.url, orden],
    );
    return { ok: true, id };
  } catch (error) {
    console.error("[herramientas] crearHerramienta falló", { usuarioId: uid, error });
    return { ok: false, motivo: "bd" };
  }
}

export async function actualizarHerramienta(
  usuarioId: string,
  id: string,
  input: HerramientaInput,
): Promise<{ ok: true } | { ok: false; motivo: "falta_dato" | "no_encontrado" | "bd" }> {
  const uid = usuarioId.trim();
  const hid = id.trim();
  const v = validarHerramientaInput(input);
  if (!uid || !hid || !v.ok) return { ok: false, motivo: "falta_dato" };

  try {
    const pool = await getPool();
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE herramientas_usuario
          SET nombre = ?, categoria = ?, descripcion = ?, url = ?
        WHERE id = ? AND usuario_id = ?`,
      [v.data.nombre, v.data.categoria, v.data.descripcion, v.data.url, hid, uid],
    );
    if (res.affectedRows === 0) return { ok: false, motivo: "no_encontrado" };
    return { ok: true };
  } catch (error) {
    console.error("[herramientas] actualizarHerramienta falló", {
      usuarioId: uid,
      id: hid,
      error,
    });
    return { ok: false, motivo: "bd" };
  }
}

export async function eliminarHerramienta(
  usuarioId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; motivo: "falta_dato" | "no_encontrado" | "bd" }> {
  const uid = usuarioId.trim();
  const hid = id.trim();
  if (!uid || !hid) return { ok: false, motivo: "falta_dato" };

  try {
    const pool = await getPool();
    const [res] = await pool.execute<ResultSetHeader>(
      "DELETE FROM herramientas_usuario WHERE id = ? AND usuario_id = ?",
      [hid, uid],
    );
    if (res.affectedRows === 0) return { ok: false, motivo: "no_encontrado" };
    return { ok: true };
  } catch (error) {
    console.error("[herramientas] eliminarHerramienta falló", {
      usuarioId: uid,
      id: hid,
      error,
    });
    return { ok: false, motivo: "bd" };
  }
}
