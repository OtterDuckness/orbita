import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

/** ISO weekday: 1=lunes … 7=domingo. Default L/X/V. */
export const DIAS_DIGEST_DEFAULT = [1, 3, 5] as const;
export const HORA_DIGEST_DEFAULT = "09:00";
export const UMBRAL_ATRASO_DIAS = 7;

export type NotifCorreoPrefs = {
  activo: boolean;
  dias: number[];
  hora: string;
};

type PrefsRow = RowDataPacket & {
  activo: number | boolean;
  dias: unknown;
  hora: string;
};

const DIAS_VALIDOS = new Set([1, 2, 3, 4, 5, 6, 7]);

export function prefsPorDefecto(): NotifCorreoPrefs {
  return {
    activo: false,
    dias: [...DIAS_DIGEST_DEFAULT],
    hora: HORA_DIGEST_DEFAULT,
  };
}

export function normalizarDias(raw: unknown): number[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) arr = p;
    } catch {
      arr = [];
    }
  }
  const dias = [
    ...new Set(
      arr
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && DIAS_VALIDOS.has(n)),
    ),
  ].sort((a, b) => a - b);
  return dias.length > 0 ? dias : [...DIAS_DIGEST_DEFAULT];
}

export function normalizarHora(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return HORA_DIGEST_DEFAULT;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(3, 5));
  if (h < 0 || h > 23 || m < 0 || m > 59) return HORA_DIGEST_DEFAULT;
  // Solo horas en punto (cron horario).
  return `${String(h).padStart(2, "0")}:00`;
}

function filaAPrefs(r: {
  activo: number | boolean;
  dias: unknown;
  hora: string;
} | undefined): NotifCorreoPrefs {
  if (!r) return prefsPorDefecto();
  return {
    activo: Boolean(r.activo),
    dias: normalizarDias(r.dias),
    hora: normalizarHora(r.hora),
  };
}

export async function obtenerPrefsNotifCorreo(
  usuarioId: string,
): Promise<NotifCorreoPrefs> {
  const uid = usuarioId.trim();
  if (!uid) return prefsPorDefecto();
  const pool = await getPool();
  const [rows] = await pool.execute<PrefsRow[]>(
    `SELECT activo, dias, hora FROM usuario_notif_prefs WHERE usuario_id = ? LIMIT 1`,
    [uid],
  );
  return filaAPrefs(rows[0]);
}

export async function guardarPrefsNotifCorreo(
  usuarioId: string,
  prefs: NotifCorreoPrefs,
): Promise<NotifCorreoPrefs> {
  const uid = usuarioId.trim();
  if (!uid) throw new Error("usuario_id vacío");
  const activo = prefs.activo ? 1 : 0;
  const dias = normalizarDias(prefs.dias);
  const hora = normalizarHora(prefs.hora);
  const pool = await getPool();
  await pool.execute(
    `INSERT INTO usuario_notif_prefs (usuario_id, activo, dias, hora)
     VALUES (?, ?, CAST(? AS JSON), ?)
     ON DUPLICATE KEY UPDATE
       activo = VALUES(activo),
       dias = VALUES(dias),
       hora = VALUES(hora)`,
    [uid, activo, JSON.stringify(dias), hora],
  );
  return { activo: Boolean(activo), dias, hora };
}

export type DestinatarioDigest = {
  id: string;
  nombre: string;
  correo: string;
  timezone: string;
  prefs: NotifCorreoPrefs;
};

/** Internos con correo; prefs reales o defaults. */
export async function listarDestinatariosDigest(): Promise<DestinatarioDigest[]> {
  const pool = await getPool();
  const [rows] = await pool.execute<
    (RowDataPacket & {
      id: string;
      nombre: string;
      correo: string;
      timezone: string | null;
      activo: number | boolean | null;
      dias: unknown;
      hora: string | null;
    })[]
  >(
    `SELECT u.id, u.nombre, u.correo, u.timezone,
            p.activo, p.dias, p.hora
     FROM usuarios u
     LEFT JOIN usuario_notif_prefs p ON p.usuario_id = u.id
     WHERE u.rol = 'interna'
       AND u.correo IS NOT NULL
       AND TRIM(u.correo) <> ''
     ORDER BY u.nombre ASC`,
  );

  const { parseZona } = await import("@/lib/zona");
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    correo: r.correo.trim().toLowerCase(),
    timezone: parseZona(r.timezone),
    prefs: filaAPrefs(
      r.hora != null || r.activo != null || r.dias != null
        ? {
            activo: r.activo ?? 0,
            dias: r.dias ?? [...DIAS_DIGEST_DEFAULT],
            hora: r.hora ?? HORA_DIGEST_DEFAULT,
          }
        : undefined,
    ),
  }));
}
