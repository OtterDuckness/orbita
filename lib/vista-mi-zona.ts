import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getPoolProd } from "@/lib/db";
import type { Permiso } from "@/lib/permisos";

/** Cookie: admin simula permisos Mi Zona de trabajador o jefe. */
export const COOKIE_VISTA_MI_ZONA = "orbita_vista_mi_zona";

export type VistaMiZona = "trabajador" | "jefe";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const PERMISOS_TRABAJADOR: readonly Permiso[] = [
  "mi_zona.ver",
  "mi_zona.fichar",
  "mi_zona.ausencias",
  "mi_zona.nominas",
];

const PERMISOS_JEFE: readonly Permiso[] = [
  "mi_zona.ver",
  "mi_zona.fichar",
  "mi_zona.ausencias",
  "mi_zona.nominas",
  "mi_zona.equipo",
  "mi_zona.aprobar_ausencias",
];

type AdminRow = RowDataPacket & { es_admin: number | boolean };

export function esVistaMiZona(v: string | null | undefined): v is VistaMiZona {
  return v === "trabajador" || v === "jefe";
}

export function permisosDeVistaMiZona(vista: VistaMiZona): readonly Permiso[] {
  return vista === "jefe" ? PERMISOS_JEFE : PERMISOS_TRABAJADOR;
}

export async function cookieVistaMiZona(): Promise<VistaMiZona | null> {
  try {
    const raw = (await cookies()).get(COOKIE_VISTA_MI_ZONA)?.value?.trim() ?? "";
    return esVistaMiZona(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Vista activa solo si el correo es admin real en BD. */
export async function leerVistaMiZonaParaAdmin(correo: string): Promise<VistaMiZona | null> {
  const email = correo.trim().toLowerCase();
  if (!email) return null;
  const pool = getPoolProd();
  const [rows] = await pool.execute<AdminRow[]>(
    "SELECT es_admin FROM usuarios WHERE correo = ? LIMIT 1",
    [email],
  );
  if (!rows[0]?.es_admin) return null;
  return cookieVistaMiZona();
}

export async function escribirCookieVistaMiZona(vista: VistaMiZona | null): Promise<void> {
  const jar = await cookies();
  const attrs = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  if (!vista) {
    jar.set(COOKIE_VISTA_MI_ZONA, "", { ...attrs, maxAge: 0 });
    return;
  }
  jar.set(COOKIE_VISTA_MI_ZONA, vista, { ...attrs, maxAge: COOKIE_MAX_AGE });
}
