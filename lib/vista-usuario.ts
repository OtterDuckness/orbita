import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getPoolProd } from "@/lib/db";

/** Cookie de sesión: admin simula permisos de usuario normal. */
export const COOKIE_VISTA_USUARIO = "orbita_vista_usuario";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type AdminRow = RowDataPacket & { es_admin: number | boolean };

/** Solo lee la cookie (sin comprobar admin). */
export async function cookieVistaUsuarioActiva(): Promise<boolean> {
  try {
    return (await cookies()).get(COOKIE_VISTA_USUARIO)?.value === "1";
  } catch {
    return false;
  }
}

/** Cookie activa y el usuario de la sesión es admin real en BD. */
export async function esVistaUsuario(): Promise<boolean> {
  if (!(await cookieVistaUsuarioActiva())) return false;

  const { auth } = await import("@/auth");
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return false;

  const pool = getPoolProd();
  const [rows] = await pool.execute<AdminRow[]>(
    "SELECT es_admin FROM usuarios WHERE correo = ? LIMIT 1",
    [email],
  );
  return Boolean(rows[0]?.es_admin);
}

export async function escribirCookieVistaUsuario(activa: boolean): Promise<void> {
  const jar = await cookies();
  const attrs = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  jar.set(COOKIE_VISTA_USUARIO, activa ? "1" : "0", { ...attrs, maxAge: COOKIE_MAX_AGE });
}
