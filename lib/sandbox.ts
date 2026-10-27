import { cookies, headers } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getPoolProd } from "@/lib/db";

export const COOKIE_SANDBOX = "orbita_sandbox";
export const HEADER_SANDBOX = "x-orbita-sandbox";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type AdminRow = RowDataPacket & { es_admin: number | boolean };

async function cookieOHeaderSandbox(): Promise<boolean> {
  try {
    const v = (await cookies()).get(COOKIE_SANDBOX)?.value;
    if (v === "1") return true;
    if (v === "0" || v === undefined) return false;
  } catch {
    /* cookies() no disponible: header que pone el middleware */
  }
  try {
    return (await headers()).get(HEADER_SANDBOX) === "1";
  } catch {
    return false;
  }
}

export async function modoDb(): Promise<"prod" | "pruebas"> {
  if (!(await cookieOHeaderSandbox())) return "prod";

  const { auth } = await import("@/auth");
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return "prod";

  const pool = getPoolProd();
  const [rows] = await pool.execute<AdminRow[]>(
    "SELECT es_admin FROM usuarios WHERE correo = ? LIMIT 1",
    [email],
  );
  return rows[0] && Boolean(rows[0].es_admin) ? "pruebas" : "prod";
}

export async function esModoPruebas(): Promise<boolean> {
  return (await modoDb()) === "pruebas";
}

export async function escribirCookieSandbox(activa: boolean): Promise<void> {
  const jar = await cookies();
  const attrs = {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  // Sobrescribir a "0" (no borrar): mismo maxAge/path/secure. Si no, el
  // redirect de la Server Action a veces no manda el Set-Cookie de delete
  // y el banner sigue con datos reales.
  jar.set(COOKIE_SANDBOX, activa ? "1" : "0", { ...attrs, maxAge: COOKIE_MAX_AGE });
}
