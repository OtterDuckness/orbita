import Link from "next/link";
import type { UsuarioInternoAsignacion } from "@/lib/perfiles";
import { AvatarUsuario } from "../../avatar-usuario";

export function PanelUsuariosPermisos({
  usuarios,
}: {
  usuarios: UsuarioInternoAsignacion[];
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="font-display font-bold text-[18px] tracking-tight">Por persona</h2>
        <p className="text-apagado text-[13px] mt-1">
          Abre cada persona para afinar Ver / Alterar o cargar una plantilla.
        </p>
      </div>
      <ul className="grid gap-2">
        {usuarios.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center gap-3 rounded-[10px] border border-linea-fuerte bg-papel px-4 py-3 hover:border-magenta-borde hover:shadow-suave transition"
          >
            <AvatarUsuario nombre={u.nombre} avatarUrl={u.avatarUrl} tamano="md" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[15px]">
                {u.nombre}
                {u.esAdmin ? (
                  <span className="ml-2 etiqueta text-magenta-texto">admin</span>
                ) : null}
              </p>
              <p className="text-apagado text-[12px] font-mono">{u.correo}</p>
              <p className="text-apagado text-[12px] mt-1">
                {u.perfilNombre ? `Perfil: ${u.perfilNombre}` : "Sin perfil"}
                {" · "}
                {u.permisos.length} permisos
              </p>
            </div>
            <Link
              href={`/admin/permisos?usuario=${u.id}`}
              className="text-[13px] text-magenta-texto hover:underline"
            >
              Modificar permisos
            </Link>
          </li>
        ))}
        {usuarios.length === 0 ? (
          <li className="text-apagado text-[13px]">Aún no hay usuarios internos.</li>
        ) : null}
      </ul>
    </section>
  );
}
