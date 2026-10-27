import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Permiso } from "@/lib/permisos";
import { obtenerUsuarioAuthPorCorreo, type UsuarioAuth, usuarioPuede } from "@/lib/usuarios";

export async function exigirSesionUsuario(): Promise<UsuarioAuth> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email);
  if (!usuario) redirect("/login?error=AccessDenied");
  return usuario;
}

export async function exigirAdmin(): Promise<UsuarioAuth> {
  const usuario = await exigirSesionUsuario();
  if (!usuario.esAdmin) redirect("/?aviso=sin_permiso");
  return usuario;
}

/** Admin real en BD, ignora la cookie de “vista usuario”. */
export async function exigirAdminReal(): Promise<UsuarioAuth> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const usuario = await obtenerUsuarioAuthPorCorreo(session.user.email, {
    ignorarVistaUsuario: true,
  });
  if (!usuario) redirect("/login?error=AccessDenied");
  if (!usuario.esAdmin) redirect("/?aviso=sin_permiso");
  return usuario;
}

export async function exigirPermiso(permiso: Permiso): Promise<UsuarioAuth> {
  const usuario = await exigirSesionUsuario();
  if (!usuarioPuede(usuario, permiso)) redirect("/?aviso=sin_permiso");
  return usuario;
}

/**
 * Alcance de listados de proyectos.
 * Por defecto solo los del usuario; admins pueden pedir `verTodo` (?todo=1).
 */
export function alcanceProyectos(
  usuario: UsuarioAuth,
  verTodoRaw: string | boolean | null | undefined,
): { soloDe: string | null; verTodo: boolean } {
  const pedirTodo =
    verTodoRaw === true ||
    verTodoRaw === "1" ||
    verTodoRaw === "true" ||
    verTodoRaw === "si";
  const verTodo = Boolean(usuario.esAdmin && pedirTodo);
  return {
    soloDe: verTodo ? null : usuario.id,
    verTodo,
  };
}
