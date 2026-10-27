import type { RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { CLAVE_AGENTE_IA_ACTIVO, escribirAjuste } from "@/lib/ajustes-globales";
import { exigirSesionUsuario } from "@/lib/authz";
import { getPool } from "@/lib/db";
import { NAV_REGISTRO, type NavItemId } from "@/lib/nav-mock";
import type { Permiso } from "@/lib/permisos";
import { usuarioPuede, type UsuarioAuth } from "@/lib/usuarios";

export type ApartadoId = NavItemId;

export type Apartado = {
  id: ApartadoId;
  nombre: string;
  href: string;
  clave: string;
  /** Valor si la fila aún no existe en `ajustes`. */
  defecto: "0" | "1";
  texto: string;
};

const META: Record<
  ApartadoId,
  { clave: string; defecto: "0" | "1"; texto: string }
> = {
  panel: {
    clave: "apartado_panel",
    defecto: "1",
    texto:
      "Página de inicio. Si está apagado, quien no es admin no la ve en el menú y, al entrar, va al primer apartado que sí tenga disponible.",
  },
  asistente: {
    clave: CLAVE_AGENTE_IA_ACTIVO,
    defecto: "1",
    texto:
      "Si está apagado, el asistente desaparece del menú y no pueden usarlo quienes no son admin. Los administradores siempre tienen acceso al chat y a la API. El panel Admin → Agente IA (consumo y chats) sigue disponible.",
  },
  mi_zona: {
    clave: "apartado_mi_zona",
    defecto: "0",
    texto:
      "Control horario, ausencias y nóminas. Apagado, solo lo ven los administradores. Quien no tenga el permiso de Mi Zona sigue sin verlo aunque esto esté encendido.",
  },
  clientes: {
    clave: "apartado_clientes",
    defecto: "1",
    texto:
      "Listado y ficha de clientes. Apagado, desaparece del menú y la URL no abre para quien no es admin.",
  },
  proyectos: {
    clave: "apartado_proyectos",
    defecto: "1",
    texto:
      "Proyectos y su tablero. Apagado, desaparece del menú y la URL no abre para quien no es admin.",
  },
  tareas: {
    clave: "apartado_tareas",
    defecto: "1",
    texto:
      "Tablero de tareas. Apagado, desaparece del menú y la URL no abre para quien no es admin.",
  },
  calendario: {
    clave: "apartado_calendario",
    defecto: "1",
    texto:
      "Calendario del equipo. Apagado, desaparece del menú y la URL no abre para quien no es admin.",
  },
  correo: {
    clave: "apartado_correo",
    defecto: "1",
    texto:
      "Bandeja Gmail del usuario (leer, adjuntos, enviar). Apagado, desaparece del menú y la URL no abre para quien no es admin.",
  },
  comunicaciones: {
    clave: "apartado_comunicaciones",
    defecto: "1",
    texto:
      "Mensajes internos. Apagado, desaparece del menú y la URL no abre para quien no es admin.",
  },
  herramientas: {
    clave: "apartado_herramientas",
    defecto: "0",
    texto:
      "Accesos directos. Apagado, solo lo ven los administradores hasta que lo actives para el equipo.",
  },
};

/** Mismo orden que el menú lateral. */
export const APARTADOS: Apartado[] = [...NAV_REGISTRO]
  .sort((a, b) => a.ordenDefault - b.ordenDefault)
  .map((item) => {
    const meta = META[item.id];
    return {
      id: item.id,
      nombre: item.nombre,
      href: item.href,
      clave: meta.clave,
      defecto: meta.defecto,
      texto: meta.texto,
    };
  });

export type ApartadosActivos = Record<ApartadoId, boolean>;

type AjusteRow = RowDataPacket & { clave: string; valor: string };

function activo(valor: string | undefined, defecto: "0" | "1"): boolean {
  const v = valor ?? defecto;
  return v === "1" || v.toLowerCase() === "true";
}

export async function leerApartados(): Promise<ApartadosActivos> {
  const pool = await getPool();
  const claves = APARTADOS.map((a) => a.clave);
  const placeholders = claves.map(() => "?").join(", ");
  const [rows] = await pool.execute<AjusteRow[]>(
    `SELECT clave, valor FROM ajustes WHERE clave IN (${placeholders})`,
    claves,
  );
  const porClave = new Map(rows.map((r) => [r.clave, r.valor]));
  const out = {} as ApartadosActivos;
  for (const a of APARTADOS) {
    out[a.id] = activo(porClave.get(a.clave), a.defecto);
  }
  return out;
}

/** Admins (no en vista usuario) ven siempre el apartado. */
export function apartadoVisible(
  activos: ApartadosActivos,
  id: ApartadoId,
  esAdmin: boolean,
): boolean {
  if (esAdmin) return true;
  return activos[id];
}

export async function puedeVerApartado(id: ApartadoId, esAdmin: boolean): Promise<boolean> {
  if (esAdmin) return true;
  const activos = await leerApartados();
  return activos[id];
}

export async function guardarApartados(
  valores: ApartadosActivos,
  actorId: string | null,
): Promise<void> {
  for (const a of APARTADOS) {
    await escribirAjuste(a.clave, valores[a.id] ? "1" : "0", actorId);
  }
}

function permisoDe(id: ApartadoId): Permiso | null {
  switch (id) {
    case "mi_zona":
      return "mi_zona.ver";
    case "clientes":
      return "clientes.ver";
    case "proyectos":
      return "proyectos.ver";
    case "tareas":
    case "calendario":
      return "tareas.ver";
    case "correo":
      return "correo.ver";
    case "comunicaciones":
      return "comunicaciones.ver";
    default:
      return null;
  }
}

/** Primera ruta que esta persona puede abrir, saltando `excluir`. */
export function primeraRutaVisible(
  usuario: UsuarioAuth,
  activos: ApartadosActivos,
  excluir?: ApartadoId,
): string | null {
  for (const item of [...NAV_REGISTRO].sort((a, b) => a.ordenDefault - b.ordenDefault)) {
    if (item.id === excluir) continue;
    if (!apartadoVisible(activos, item.id, usuario.esAdmin)) continue;
    const perm = permisoDe(item.id);
    if (perm && !usuarioPuede(usuario, perm)) continue;
    return item.href;
  }
  return null;
}

/** Quien no es admin y tiene el apartado apagado sale a otra sección. */
export async function exigirApartado(id: ApartadoId): Promise<void> {
  const usuario = await exigirSesionUsuario();
  const activos = await leerApartados();
  if (apartadoVisible(activos, id, usuario.esAdmin)) return;
  const destino = primeraRutaVisible(usuario, activos, id);
  if (!destino) redirect("/?aviso=apartado_off");
  redirect(destino === "/" ? "/?aviso=apartado_off" : `${destino}?aviso=apartado_off`);
}
